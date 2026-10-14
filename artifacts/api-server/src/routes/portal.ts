import { Router, type IRouter, type Request, type RequestHandler, type Response, type NextFunction } from "express";
import { randomBytes } from "node:crypto";
import cookieParser from "cookie-parser";
import { publicBase } from "./portal-config";
import { PASSWORD_MAX, PASSWORD_MIN, hashPassword, hashToken, verifyPassword } from "./portal-crypto";
import {
  db,
  portalClientsTable,
  portalLoginTokensTable,
  portalSessionsTable,
  portalSettingsTable,
  portalCompaniesTable,
} from "@workspace/db";
import { and, eq, gt, sql } from "drizzle-orm";
import { limiter } from "./portal-rate-limit";

const router: IRouter = Router();
router.use("/portal", cookieParser());

const COOKIE = "portal_session";
const SESSION_DAYS = 30;
const TOKEN_MINUTES = 15;
const isProd = process.env.NODE_ENV === "production";

type Client = typeof portalClientsTable.$inferSelect;
export type Authed = Request & { client: Client; justSignedIn: boolean };

const token = () => randomBytes(24).toString("base64url");
export const asyncRoute = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
  fn(req, res).catch(next);

async function requireClient(req: Request, res: Response, next: NextFunction) {
  try {
    const sid = req.cookies?.[COOKIE];
    if (sid) {
      const [row] = await db
        .select({ client: portalClientsTable, expiresAt: portalSessionsTable.expiresAt })
        .from(portalSessionsTable)
        .innerJoin(portalClientsTable, eq(portalClientsTable.id, portalSessionsTable.clientId))
        .where(and(eq(portalSessionsTable.id, hashToken(sid)), gt(portalSessionsTable.expiresAt, new Date())));
      if (row) {
        (req as Authed).client = row.client;
        // "Fresh" = signed in within the last 15 minutes (e.g. via the emailed link), which lets someone who forgot their password set a new one.
        (req as Authed).justSignedIn = +row.expiresAt - SESSION_DAYS * 86_400_000 > Date.now() - TOKEN_MINUTES * 60_000;
        return next();
      }
    }
    res.status(401).json({ error: "Not signed in" });
  } catch (e) { next(e); }
}

function requireManager(req: Request, res: Response, next: NextFunction) {
  if ((req as Authed).client.role !== "admin") { res.status(403).json({ error: "Admins only" }); return; }
  next();
}
export const guard: RequestHandler[] = [requireClient];
export const managerGuard: RequestHandler[] = [requireClient, requireManager];

// ── Auth (magic link) ───────────────────────────────────────────────────────
// Limits so nobody can flood someone's inbox with sign-in emails or hammer the password form.
// On in production; locally only with PORTAL_LOGIN_LIMITS=1 (the spec check signs in many times).
const limitsOn = isProd || process.env.PORTAL_LOGIN_LIMITS === "1";
const off = { hit: () => false };
const linkPerEmail = limitsOn ? limiter(5, 15 * 60_000) : off, linkPerIp = limitsOn ? limiter(30, 60 * 60_000) : off, passwordPerIp = limitsOn ? limiter(30, 15 * 60_000) : off;
const SLOW_DOWN = "Too many attempts. Please wait a few minutes and try again.";

router.post("/portal/auth/request", asyncRoute(async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase().slice(0, 254);
  if (!email) { res.status(400).json({ error: "Email required" }); return; }
  if (linkPerIp.hit(req.ip ?? "unknown") || linkPerEmail.hit(email)) { res.status(429).json({ error: SLOW_DOWN }); return; }
  const [client] = await db.select().from(portalClientsTable).where(eq(portalClientsTable.email, email));
  // Same response for known and unknown emails, so addresses can't be enumerated.
  if (!client) { res.json({ ok: true }); return; }
  const t = token();
  await db.insert(portalLoginTokensTable).values({ token: hashToken(t), clientId: client.id, expiresAt: new Date(Date.now() + TOKEN_MINUTES * 60_000) });
  const link = `${publicBase(req.body?.origin)}/api/portal/auth/verify?token=${t}`;
  // No mailer wired up yet. Outside production the link is logged and returned to the browser so it can be tested locally.
  // In production it must never reach the logs or the response: anyone who saw it could sign in as that person.
  if (!isProd) console.log(`[portal] sign-in link for ${email}: ${link}`);
  res.json(isProd ? { ok: true } : { ok: true, devLink: link });
}));

async function startSession(res: Response, clientId: string) {
  const sid = token();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(portalSessionsTable).values({ id: hashToken(sid), clientId, expiresAt }); // the cookie holds sid; only its hash is stored
  res.cookie(COOKIE, sid, { httpOnly: true, sameSite: "lax", secure: isProd, expires: expiresAt, path: "/" });
}

router.get("/portal/auth/verify", asyncRoute(async (req, res) => {
  const t = String(req.query.token ?? "");
  const [row] = await db.select().from(portalLoginTokensTable).where(and(eq(portalLoginTokensTable.token, hashToken(t)), gt(portalLoginTokensTable.expiresAt, new Date())));
  if (!row || row.usedAt) { res.redirect("/login?error=expired"); return; }
  await db.update(portalLoginTokensTable).set({ usedAt: new Date() }).where(eq(portalLoginTokensTable.token, hashToken(t)));
  await startSession(res, row.clientId);
  // An invite lands on the account page so the new person can choose a password (optional).
  res.redirect(row.purpose === "invite" ? "/app/account?welcome=1" : "/app");
}));

// Password login. Wrong email and wrong password look the same. 5 wrong tries lock that account for 15 minutes
// (the emailed sign-in link still works, so a lockout can't shut anyone out of the office tool).
const MAX_FAILS = 5;
router.post("/portal/auth/password", asyncRoute(async (req, res) => {
  if (passwordPerIp.hit(req.ip ?? "unknown")) { res.status(429).json({ error: SLOW_DOWN }); return; }
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "").slice(0, PASSWORD_MAX);
  const [c] = email ? await db.select().from(portalClientsTable).where(eq(portalClientsTable.email, email)) : [];
  if (c?.lockedUntil && c.lockedUntil > new Date()) {
    res.status(429).json({ error: "Too many wrong attempts. Try again in a few minutes, or use a sign-in link." }); return;
  }
  const ok = await verifyPassword(password, c?.passwordHash ?? null);
  if (!c || !ok) {
    if (c) {
      const fails = c.failedLogins + 1;
      await db.update(portalClientsTable).set(fails >= MAX_FAILS ? { failedLogins: 0, lockedUntil: new Date(Date.now() + 15 * 60_000) } : { failedLogins: fails }).where(eq(portalClientsTable.id, c.id));
    }
    res.status(401).json({ error: "Wrong email or password." }); return;
  }
  await db.update(portalClientsTable).set({ failedLogins: 0, lockedUntil: null }).where(eq(portalClientsTable.id, c.id));
  await startSession(res, c.id);
  res.json({ ok: true });
}));

// Set or change your own password. Needs the current password, unless you just signed in with the emailed link.
router.post("/portal/auth/set-password", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const password = String(req.body?.password ?? "");
  if (password.length < PASSWORD_MIN) { res.status(400).json({ error: `Use at least ${PASSWORD_MIN} characters.` }); return; }
  if (password.length > PASSWORD_MAX) { res.status(400).json({ error: "That password is too long." }); return; }
  if (me.passwordHash && !(req as Authed).justSignedIn) {
    if (!(await verifyPassword(String(req.body?.currentPassword ?? ""), me.passwordHash))) { res.status(403).json({ error: "Your current password is wrong." }); return; }
  }
  await db.update(portalClientsTable).set({ passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null }).where(eq(portalClientsTable.id, me.id));
  // Sign out every other device.
  const sid = req.cookies?.[COOKIE];
  await db.delete(portalSessionsTable).where(and(eq(portalSessionsTable.clientId, me.id), sid ? sql`${portalSessionsTable.id} <> ${hashToken(sid)}` : undefined));
  res.json({ ok: true });
}));

router.post("/portal/auth/logout", asyncRoute(async (req, res) => {
  const sid = req.cookies?.[COOKIE];
  if (sid) await db.delete(portalSessionsTable).where(eq(portalSessionsTable.id, hashToken(sid)));
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ ok: true });
}));

router.get("/portal/me", guard, asyncRoute(async (req, res) => {
  const c = (req as Authed).client;
  const [co] = c.companyId ? await db.select().from(portalCompaniesTable).where(eq(portalCompaniesTable.id, c.companyId)) : [];
  res.json({ id: c.id, name: c.name, email: c.email, role: c.role, kind: c.kind, company: co?.name ?? null, hasPassword: !!c.passwordHash });
}));


export default router;
