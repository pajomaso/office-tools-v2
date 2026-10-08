import { Router, type IRouter, type Request, type RequestHandler, type Response, type NextFunction } from "express";
import { randomBytes } from "node:crypto";
import cookieParser from "cookie-parser";
import { PASSWORD_MAX, PASSWORD_MIN, hashPassword, verifyPassword } from "./portal-crypto";
import {
  db,
  portalClientsTable,
  portalRoomsTable,
  portalBookingsTable,
  portalReportsTable,
  portalLoginTokensTable,
  portalSessionsTable,
  portalSettingsTable,
  portalCompaniesTable,
} from "@workspace/db";
import { and, asc, desc, eq, gt, gte, lt, sql } from "drizzle-orm";
import { isValidDate, isValidTime, lisbonToUtc, partsOf } from "./portal-time";

const router: IRouter = Router();
router.use("/portal", cookieParser());

const COOKIE = "portal_session";
const SESSION_DAYS = 30;
const TOKEN_MINUTES = 15;
const OPEN_HOUR = 8;
const CLOSE_HOUR = 20;
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
        .where(and(eq(portalSessionsTable.id, sid), gt(portalSessionsTable.expiresAt, new Date())));
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
router.post("/portal/auth/request", asyncRoute(async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!email) { res.status(400).json({ error: "Email required" }); return; }
  const [client] = await db.select().from(portalClientsTable).where(eq(portalClientsTable.email, email));
  // Same response for known and unknown emails, so addresses can't be enumerated.
  if (!client) { res.json({ ok: true }); return; }
  const t = token();
  await db.insert(portalLoginTokensTable).values({ token: t, clientId: client.id, expiresAt: new Date(Date.now() + TOKEN_MINUTES * 60_000) });
  const base = process.env.PORTAL_URL || String(req.body?.origin || "http://localhost:5174");
  const link = `${base}/api/portal/auth/verify?token=${t}`;
  // No mailer wired up yet: the link is logged, and returned to the browser outside production.
  console.log(`[portal] sign-in link for ${email}: ${link}`);
  res.json(isProd ? { ok: true } : { ok: true, devLink: link });
}));

async function startSession(res: Response, clientId: string) {
  const sid = token();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(portalSessionsTable).values({ id: sid, clientId, expiresAt });
  res.cookie(COOKIE, sid, { httpOnly: true, sameSite: "lax", secure: isProd, expires: expiresAt, path: "/" });
}

router.get("/portal/auth/verify", asyncRoute(async (req, res) => {
  const t = String(req.query.token ?? "");
  const [row] = await db.select().from(portalLoginTokensTable).where(and(eq(portalLoginTokensTable.token, t), gt(portalLoginTokensTable.expiresAt, new Date())));
  if (!row || row.usedAt) { res.redirect("/login?error=expired"); return; }
  await db.update(portalLoginTokensTable).set({ usedAt: new Date() }).where(eq(portalLoginTokensTable.token, t));
  await startSession(res, row.clientId);
  // An invite lands on the account page so the new person can choose a password (optional).
  res.redirect(row.purpose === "invite" ? "/app/account?welcome=1" : "/app");
}));

// Password login. Wrong email and wrong password look the same. 5 wrong tries lock that account for 15 minutes
// (the emailed sign-in link still works, so a lockout can't shut anyone out of the office tool).
const MAX_FAILS = 5;
router.post("/portal/auth/password", asyncRoute(async (req, res) => {
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
  await db.delete(portalSessionsTable).where(and(eq(portalSessionsTable.clientId, me.id), sid ? sql`${portalSessionsTable.id} <> ${sid}` : undefined));
  res.json({ ok: true });
}));

router.post("/portal/auth/logout", asyncRoute(async (req, res) => {
  const sid = req.cookies?.[COOKIE];
  if (sid) await db.delete(portalSessionsTable).where(eq(portalSessionsTable.id, sid));
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ ok: true });
}));

router.get("/portal/me", guard, asyncRoute(async (req, res) => {
  const c = (req as Authed).client;
  const [co] = c.companyId ? await db.select().from(portalCompaniesTable).where(eq(portalCompaniesTable.id, c.companyId)) : [];
  res.json({ id: c.id, name: c.name, email: c.email, role: c.role, kind: c.kind, company: co?.name ?? null, hasPassword: !!c.passwordHash });
}));


// ── Rooms, bookings ─────────────────────────────────────────────────────────
router.get("/portal/rooms", guard, asyncRoute(async (_req, res) => {
  res.json(await db.select().from(portalRoomsTable).orderBy(asc(portalRoomsTable.sortOrder), asc(portalRoomsTable.name)));
}));

const serialize = (b: typeof portalBookingsTable.$inferSelect, mine: boolean) => ({
  id: b.id, roomId: b.roomId, startsAt: b.startsAt.toISOString(), endsAt: b.endsAt.toISOString(), mine,
  // Other clients' bookings are anonymised.
  ...(mine ? { title: b.title, attendees: b.attendees, notes: b.notes } : {}),
});

router.get("/portal/bookings", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const from = new Date(String(req.query.from ?? "")), to = new Date(String(req.query.to ?? ""));
  if (isNaN(+from) || isNaN(+to)) { res.status(400).json({ error: "from/to required" }); return; }
  const rows = await db.select().from(portalBookingsTable).where(and(lt(portalBookingsTable.startsAt, to), gt(portalBookingsTable.endsAt, from)));
  res.json(rows.map((b) => serialize(b, b.clientId === me.id)));
}));

router.post("/portal/bookings", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const { roomId, title, attendees, notes, date, start, end } = req.body ?? {};
  if (!roomId || !String(title ?? "").trim()) { res.status(400).json({ error: "A title and a room are required." }); return; }
  if (!isValidDate(date) || !isValidTime(start) || !isValidTime(end)) { res.status(400).json({ error: "Pick a date, start and end." }); return; }
  const startsAt = lisbonToUtc(date, start), endsAt = lisbonToUtc(date, end);
  if (endsAt <= startsAt) { res.status(400).json({ error: "End must be after start." }); return; }
  if (startsAt < new Date()) { res.status(400).json({ error: "That time has already passed." }); return; }

  const sp = partsOf(startsAt), ep = partsOf(endsAt);
  const startH = sp.h + sp.min / 60, endH = ep.h + ep.min / 60;
  if (sp.dow === 0 || sp.dow === 6 || startH < OPEN_HOUR || endH > CLOSE_HOUR) {
    res.status(400).json({ error: `Bookings must fall within office hours (Mon–Fri, ${OPEN_HOUR}:00–${CLOSE_HOUR}:00).` }); return;
  }
  const [room] = await db.select().from(portalRoomsTable).where(eq(portalRoomsTable.id, roomId));
  if (!room) { res.status(404).json({ error: "Room not found." }); return; }
  const n = Number(attendees) || 1;
  if (n < 1 || n > room.seats) { res.status(400).json({ error: `${room.name} seats ${room.seats}.` }); return; }

  const result = await db.transaction(async (tx) => {
    // Serialise per room so two people can't take the same slot at the same moment.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"room:" + roomId}))`);
    const [clash] = await tx.select({ id: portalBookingsTable.id }).from(portalBookingsTable)
      .where(and(eq(portalBookingsTable.roomId, roomId), lt(portalBookingsTable.startsAt, endsAt), gt(portalBookingsTable.endsAt, startsAt))).limit(1);
    if (clash) return { error: "That slot was just taken. Pick another time.", status: 409 };

    const [row] = await tx.insert(portalBookingsTable)
      .values({ roomId, clientId: me.id, title: String(title).trim(), attendees: n, startsAt, endsAt, notes: String(notes ?? "") }).returning();
    return { row };
  });
  if (!("row" in result) || !result.row) { res.status("status" in result ? result.status : 500).json({ error: "error" in result ? result.error : "Could not save." }); return; }
  res.status(201).json(serialize(result.row, true));
}));

// Rooms: cancel any time before the meeting starts. The room is freed immediately.
router.delete("/portal/bookings/:id", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const deleted = await db.delete(portalBookingsTable)
    .where(and(eq(portalBookingsTable.id, String(req.params.id)), eq(portalBookingsTable.clientId, me.id), gt(portalBookingsTable.startsAt, new Date())))
    .returning({ id: portalBookingsTable.id });
  if (!deleted.length) { res.status(404).json({ error: "Booking not found, or the meeting already started." }); return; }
  res.json({ ok: true });
}));

// ── My bookings, summary, office info ───────────────────────────────────────
router.get("/portal/my-bookings", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const now = new Date();
  const sixMonthsAgo = new Date(now); sixMonthsAgo.setMonth(now.getMonth() - 6);
  const rows = await db.select().from(portalBookingsTable)
    .where(and(eq(portalBookingsTable.clientId, me.id), gte(portalBookingsTable.endsAt, sixMonthsAgo))).orderBy(asc(portalBookingsTable.startsAt));
  const all = rows.map((b) => serialize(b, true));
  res.json({
    upcoming: all.filter((b) => new Date(b.endsAt) > now),
    past: all.filter((b) => new Date(b.endsAt) <= now).reverse(),
  });
}));

router.get("/portal/summary", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const now = new Date();
  const upcoming = (await db.select().from(portalBookingsTable).where(and(eq(portalBookingsTable.clientId, me.id), gt(portalBookingsTable.endsAt, now))).orderBy(asc(portalBookingsTable.startsAt))).slice(0, 3);
  const [{ n: updated }] = await db.select({ n: sql<number>`count(*)::int` }).from(portalReportsTable)
    .where(and(eq(portalReportsTable.clientId, me.id), eq(portalReportsTable.reporterNotified, false)));
  res.json({ upcoming: upcoming.map((b) => serialize(b, true)), updatedReports: updated });
}));

router.get("/portal/office", guard, asyncRoute(async (_req, res) => {
  const rows = await db.select().from(portalSettingsTable);
  const get = (k: string, d: unknown) => rows.find((r) => r.key === k)?.value ?? d;
  res.json({ wifi: get("wifi", []), videos: get("videos", []), info: get("info", {}) });
}));

// ── Reports: issues + supply requests ───────────────────────────────────────
const KINDS = ["issue", "supply"];
const STATUSES = ["open", "in_progress", "done"];

router.get("/portal/reports", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const rows = await db.select().from(portalReportsTable).where(eq(portalReportsTable.clientId, me.id)).orderBy(desc(portalReportsTable.createdAt));
  res.json(rows.map((r) => ({ ...r, updated: !r.reporterNotified })));
}));

router.post("/portal/reports", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const { kind, title, details } = req.body ?? {};
  if (!KINDS.includes(kind) || !String(title ?? "").trim()) { res.status(400).json({ error: "Say what's broken or missing." }); return; }
  const [row] = await db.insert(portalReportsTable).values({ clientId: me.id, kind, title: String(title).trim(), details: String(details ?? "") }).returning();
  res.status(201).json(row);
}));

router.post("/portal/reports/seen", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  await db.update(portalReportsTable).set({ reporterNotified: true }).where(eq(portalReportsTable.clientId, me.id));
  res.json({ ok: true });
}));

// ── Manager inbox ───────────────────────────────────────────────────────────
router.get("/portal/inbox", managerGuard, asyncRoute(async (_req, res) => {
  const rows = await db.select({ r: portalReportsTable, name: portalClientsTable.name, email: portalClientsTable.email })
    .from(portalReportsTable).innerJoin(portalClientsTable, eq(portalClientsTable.id, portalReportsTable.clientId))
    .orderBy(desc(portalReportsTable.createdAt));
  const rank: Record<string, number> = { open: 0, in_progress: 1, done: 2 };
  // Issues before supplies, open before done, oldest first within a bucket: what needs doing first.
  const sorted = rows.sort((a, b) => rank[a.r.status] - rank[b.r.status] || (a.r.kind === b.r.kind ? +a.r.createdAt - +b.r.createdAt : a.r.kind === "issue" ? -1 : 1));
  res.json(sorted.map(({ r, name, email }) => ({ ...r, reporter: name, reporterEmail: email })));
}));

router.patch("/portal/inbox/:id", managerGuard, asyncRoute(async (req, res) => {
  const { status, managerNote } = req.body ?? {};
  if (status !== undefined && !STATUSES.includes(status)) { res.status(400).json({ error: "Unknown status." }); return; }
  const [row] = await db.update(portalReportsTable)
    .set({ ...(status !== undefined ? { status } : {}), ...(managerNote !== undefined ? { managerNote: String(managerNote) } : {}), reporterNotified: false, updatedAt: new Date() })
    .where(eq(portalReportsTable.id, String(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "Not found." }); return; }
  res.json(row);
}));



export default router;
