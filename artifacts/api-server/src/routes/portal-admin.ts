import { Router, type IRouter } from "express";
import cookieParser from "cookie-parser";
import {
  db,
  portalClientsTable,
  portalTagsTable,
  portalTagChangesTable,
  portalItemsTable,
  portalSettingsTable,
  portalCompaniesTable,
  portalLoginTokensTable,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { asyncRoute, guard, managerGuard, type Authed } from "./portal";
import { codeFingerprint, decryptCode, encryptCode, isValidCode } from "./portal-crypto";
import { CODE_TAKEN, addChange, inboxTagCounts, isUniqueViolation, log } from "./portal-tags";
import { DEFAULT_WELCOME, renderWelcome, sendMail, type WelcomeCopy } from "./portal-mail";
import { randomBytes } from "node:crypto";

const router: IRouter = Router();
router.use("/portal", cookieParser());

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (res: import("express").Response, status: number, error: string) => { res.status(status).json({ error }); };

// ── Users, companies, onboarding ────────────────────────────────────────────
const EMAIL = /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/;
const ROLES = ["user", "admin"], KINDS = ["company", "event"];

router.get("/portal/admin/companies", managerGuard, asyncRoute(async (_req, res) => {
  res.json(await db.select().from(portalCompaniesTable).orderBy(asc(portalCompaniesTable.name)));
}));

router.post("/portal/admin/companies", managerGuard, asyncRoute(async (req, res) => {
  const name = String(req.body?.name ?? "").trim().slice(0, 120);
  if (!name) { bad(res, 400, "Give the company a name."); return; }
  const [dupe] = await db.select({ id: portalCompaniesTable.id }).from(portalCompaniesTable).where(sql`lower(${portalCompaniesTable.name}) = ${name.toLowerCase()}`);
  if (dupe) { bad(res, 409, "That company already exists."); return; }
  const [row] = await db.insert(portalCompaniesTable).values({ name }).returning();
  res.status(201).json(row);
}));

router.get("/portal/admin/users", managerGuard, asyncRoute(async (_req, res) => {
  const users = await db.select({ u: portalClientsTable, company: portalCompaniesTable.name }).from(portalClientsTable)
    .leftJoin(portalCompaniesTable, eq(portalCompaniesTable.id, portalClientsTable.companyId)).orderBy(asc(portalClientsTable.name));
  const tags = await db.select().from(portalTagsTable).where(eq(portalTagsTable.status, "active"));
  // A person is "waiting for a tag" while an assign/reassign line to them is still pending.
  const waiting = await db.select({ toUserId: portalTagChangesTable.toUserId, number: portalTagsTable.number }).from(portalTagChangesTable)
    .innerJoin(portalTagsTable, eq(portalTagsTable.id, portalTagChangesTable.tagId))
    .where(and(eq(portalTagChangesTable.status, "pending"), inArray(portalTagChangesTable.kind, ["assign", "reassign"])));
  res.json(users.map(({ u, company }) => ({
    id: u.id, email: u.email, name: u.name, role: u.role, kind: u.kind, companyId: u.companyId, company, hasPassword: !!u.passwordHash,
    tag: tags.find((t) => t.clientId === u.id)?.number ?? null,
    pendingTag: waiting.find((w) => w.toUserId === u.id)?.number ?? null,
    hasOpenRequest: waiting.some((w) => w.toUserId === u.id),
  })));
}));

function userFields(b: Record<string, unknown>) {
  const kind = KINDS.includes(String(b.kind)) ? String(b.kind) : "company";
  const companyId = kind === "event" || !b.companyId ? null : String(b.companyId);
  if (companyId && !UUID.test(companyId)) return { ok: false as const, error: "Unknown company." };
  return { ok: true as const, kind, companyId, role: ROLES.includes(String(b.role)) ? String(b.role) : "user" };
}

router.post("/portal/admin/users", managerGuard, asyncRoute(async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const name = String(req.body?.name ?? "").trim().slice(0, 120);
  if (!EMAIL.test(email) || !name) { bad(res, 400, "A name and a valid email are required."); return; }
  const f = userFields(req.body ?? {});
  if (!f.ok) { bad(res, 400, f.error); return; }
  const [dupe] = await db.select({ id: portalClientsTable.id }).from(portalClientsTable).where(eq(portalClientsTable.email, email));
  if (dupe) { bad(res, 409, "A user with that email already exists."); return; }
  const [row] = await db.insert(portalClientsTable).values({ email, name, kind: f.kind, companyId: f.companyId, role: f.role }).returning();
  res.status(201).json({ id: row!.id });
}));

router.patch("/portal/admin/users/:id", managerGuard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const id = String(req.params.id);
  const name = String(req.body?.name ?? "").trim().slice(0, 120);
  if (!name) { bad(res, 400, "Name can't be empty."); return; }
  const f = userFields(req.body ?? {});
  if (!f.ok) { bad(res, 400, f.error); return; }
  if (id === me.id && f.role !== "admin") { bad(res, 400, "You can't remove your own admin role. Ask another admin."); return; }
  const [row] = await db.update(portalClientsTable).set({ name, kind: f.kind, companyId: f.companyId, role: f.role }).where(eq(portalClientsTable.id, id)).returning({ id: portalClientsTable.id });
  if (!row) { bad(res, 404, "User not found."); return; }
  res.json({ ok: true });
}));

// ── Welcome email (copy editable by admins) ─────────────────────────────────
async function welcomeCopy(): Promise<WelcomeCopy> {
  const [row] = await db.select().from(portalSettingsTable).where(eq(portalSettingsTable.key, "welcome_email"));
  const v = row?.value as Partial<WelcomeCopy> | undefined;
  return { subject: v?.subject || DEFAULT_WELCOME.subject, body: v?.body || DEFAULT_WELCOME.body };
}

router.get("/portal/admin/welcome-email", managerGuard, asyncRoute(async (_req, res) => { res.json(await welcomeCopy()); }));

router.put("/portal/admin/welcome-email", managerGuard, asyncRoute(async (req, res) => {
  const subject = String(req.body?.subject ?? "").trim().slice(0, 200);
  const body = String(req.body?.body ?? "").slice(0, 8000);
  if (!subject || !body.trim()) { bad(res, 400, "The subject and the text can't be empty."); return; }
  await db.insert(portalSettingsTable).values({ key: "welcome_email", value: { subject, body } }).onConflictDoUpdate({ target: portalSettingsTable.key, set: { value: { subject, body } } });
  res.json({ subject, body });
}));

// Builds the welcome email for a user (with a 7-day single-use invite link) and hands it to the mailer.
async function inviteAndWelcome(user: typeof portalClientsTable.$inferSelect, origin: string) {
  const t = randomBytes(24).toString("base64url");
  await db.insert(portalLoginTokensTable).values({ token: t, clientId: user.id, purpose: "invite", expiresAt: new Date(Date.now() + 7 * 86_400_000) });
  const link = `${process.env.PORTAL_URL || origin}/api/portal/auth/verify?token=${t}`;
  const [own] = await db.select().from(portalTagsTable).where(and(eq(portalTagsTable.clientId, user.id), eq(portalTagsTable.status, "active"))).limit(1);
  const [waiting] = own ? [] : await db.select({ t: portalTagsTable }).from(portalTagChangesTable).innerJoin(portalTagsTable, eq(portalTagsTable.id, portalTagChangesTable.tagId))
    .where(and(eq(portalTagChangesTable.toUserId, user.id), eq(portalTagChangesTable.status, "pending"), inArray(portalTagChangesTable.kind, ["assign", "reassign"]))).limit(1);
  const tag = own ?? waiting?.t;
  const mail = renderWelcome(await welcomeCopy(), { name: user.name, tag: tag?.number ?? "(not assigned yet)", code: tag?.codeEnc ? decryptCode(tag.codeEnc) : "(not set yet)", link });
  const { sent } = await sendMail({ to: user.email, ...mail });
  return { sent, preview: { to: user.email, ...mail }, devLink: process.env.NODE_ENV === "production" ? undefined : link };
}

router.post("/portal/admin/users/:id/invite", managerGuard, asyncRoute(async (req, res) => {
  const [user] = await db.select().from(portalClientsTable).where(eq(portalClientsTable.id, String(req.params.id)));
  if (!user) { bad(res, 404, "User not found."); return; }
  res.json(await inviteAndWelcome(user, String(req.body?.origin || "http://localhost:5174")));
}));

// Onboarding step 2-4: give the user a tag, choose the 4-digit code, and add the change to the pending batch for Ricardo.
// The tag keeps its old state (and shows as "pending") until the supplier marks the line done.
router.post("/portal/admin/users/:id/onboard", managerGuard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const tagNumber = String(req.body?.tagNumber ?? "").trim().slice(0, 40);
  const code = req.body?.code;
  if (!tagNumber) { bad(res, 400, "Enter the tag number."); return; }
  if (!isValidCode(code)) { bad(res, 400, "A code is exactly 4 digits."); return; }
  const [user] = await db.select().from(portalClientsTable).where(eq(portalClientsTable.id, String(req.params.id)));
  if (!user) { bad(res, 404, "User not found."); return; }

  let out: { error: string; status: number } | { ok: true };
  try {
    out = await db.transaction(async (tx) => {
      const fp = codeFingerprint(code);
      let [tag] = await tx.select().from(portalTagsTable).where(eq(portalTagsTable.number, tagNumber)).for("update");
      const [clash] = await tx.select({ id: portalTagsTable.id }).from(portalTagsTable).where(eq(portalTagsTable.codeFp, fp));
      if (clash && clash.id !== tag?.id) return { error: CODE_TAKEN, status: 409 };
      // A brand-new number is a new tag from the supplier: record it as spare, then assign it.
      if (!tag) [tag] = await tx.insert(portalTagsTable).values({ number: tagNumber, status: "spare", companyId: user.companyId }).returning();
      const r = await addChange(tx, { tag: tag!, kind: "assign", toUserId: user.id, note: "Onboarding", adminId: me.id });
      if ("error" in r) return r;
      await tx.update(portalTagsTable).set({ codeEnc: encryptCode(code), codeFp: fp }).where(eq(portalTagsTable.id, tag!.id));
      await log(tx, { tag, event: "change_added", detail: `assign to ${user.name} added to the pending batch (onboarding)`, actor: me.name });
      return { ok: true } as const;
    });
  } catch (e) { if (isUniqueViolation(e)) { bad(res, 409, CODE_TAKEN); return; } throw e; }
  if (!("ok" in out)) { bad(res, out.status, out.error); return; }
  const welcome = req.body?.sendWelcome === false ? null : await inviteAndWelcome(user, String(req.body?.origin || "http://localhost:5174"));
  res.status(201).json({ ok: true, welcome });
}));

// ── Inbox: one number for "needs an admin" ──────────────────────────────────
router.get("/portal/inbox/count", managerGuard, asyncRoute(async (req, res) => {
  const [{ n: items }] = await db.select({ n: sql<number>`count(*)::int` }).from(portalItemsTable).where(and(eq(portalItemsTable.status, "open"), sql`${portalItemsTable.claimedBy} is null`));
  const t = await inboxTagCounts((req as Authed).client.id);
  res.json({ pending: items + (t.openLines ? 1 : 0) + t.unread, items, openTagLines: t.openLines, supplierUpdates: t.unread });
}));

export default router;
