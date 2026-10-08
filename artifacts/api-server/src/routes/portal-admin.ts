import { Router, type IRouter } from "express";
import cookieParser from "cookie-parser";
import {
  db,
  portalClientsTable,
  portalTagsTable,
  portalTagRequestsTable,
  portalItemsTable,
  portalSettingsTable,
  portalCompaniesTable,
  portalLoginTokensTable,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { asyncRoute, guard, managerGuard, type Authed } from "./portal";
import { codeFingerprint, decryptCode, encryptCode, isValidCode } from "./portal-crypto";
import { DEFAULT_WELCOME, renderWelcome, sendMail, type WelcomeCopy } from "./portal-mail";
import { randomBytes } from "node:crypto";

const router: IRouter = Router();
router.use("/portal", cookieParser());

const OPEN_REQ = ["to_send", "sent"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (res: import("express").Response, status: number, error: string) => { res.status(status).json({ error }); };

// ── Tags: what the client sees ──────────────────────────────────────────────
router.get("/portal/my-tag", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const tags = await db.select().from(portalTagsTable).where(eq(portalTagsTable.clientId, me.id)).orderBy(desc(portalTagsTable.createdAt));
  const requests = await db.select().from(portalTagRequestsTable).where(eq(portalTagRequestsTable.clientId, me.id)).orderBy(desc(portalTagRequestsTable.createdAt)).limit(10);
  const pub = (t: (typeof tags)[number]) => ({ id: t.id, number: t.number, status: t.status, access: t.access, hasCode: !!t.codeEnc });
  const active = tags.find((t) => t.status === "active");
  res.json({ tag: active ? pub(active) : null, requests });
}));

// U6/I5: "I need a tag" / "I lost my tag". The request lands in the manager's log as "to send".
router.post("/portal/tag-requests", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const note = String(req.body?.note ?? "").slice(0, 500);
  const out = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"tagreq:" + me.id}))`);
    const [open] = await tx.select({ id: portalTagRequestsTable.id }).from(portalTagRequestsTable)
      .where(and(eq(portalTagRequestsTable.clientId, me.id), inArray(portalTagRequestsTable.status, OPEN_REQ))).limit(1);
    if (open) return { error: "You already have a tag request in progress.", status: 409 };
    const [active] = await tx.select().from(portalTagsTable).where(and(eq(portalTagsTable.clientId, me.id), eq(portalTagsTable.status, "active"))).limit(1);
    const [row] = await tx.insert(portalTagRequestsTable)
      .values({ clientId: me.id, kind: active ? "replace" : "new", oldTagId: active?.id ?? null, note }).returning();
    return { row };
  });
  if (!("row" in out)) { bad(res, out.status, out.error); return; }
  res.status(201).json(out.row);
}));

// ── Tags: manager ───────────────────────────────────────────────────────────
router.get("/portal/admin/tags", managerGuard, asyncRoute(async (_req, res) => {
  const tags = await db.select({ t: portalTagsTable, client: portalClientsTable.name })
    .from(portalTagsTable).leftJoin(portalClientsTable, eq(portalClientsTable.id, portalTagsTable.clientId)).orderBy(asc(portalTagsTable.number));
  const reqs = await db.select({ r: portalTagRequestsTable, client: portalClientsTable.name, clientEmail: portalClientsTable.email, oldNumber: portalTagsTable.number })
    .from(portalTagRequestsTable)
    .innerJoin(portalClientsTable, eq(portalClientsTable.id, portalTagRequestsTable.clientId))
    .leftJoin(portalTagsTable, eq(portalTagsTable.id, portalTagRequestsTable.oldTagId))
    .orderBy(desc(portalTagRequestsTable.createdAt)).limit(100);
  const supplier = (await db.select().from(portalSettingsTable).where(eq(portalSettingsTable.key, "supplier")))[0]?.value ?? {};
  res.json({
    tags: tags.map(({ t, client }) => ({ id: t.id, number: t.number, clientId: t.clientId, access: t.access, status: t.status, hasCode: !!t.codeEnc, client })),
    requests: reqs.map(({ r, client, clientEmail, oldNumber }) => ({ ...r, client, clientEmail, oldNumber })),
    supplier,
  });
}));

// The tag supplier's contact, set by the manager when it's known. Empty clears it.
router.put("/portal/admin/supplier", managerGuard, asyncRoute(async (req, res) => {
  const name = String(req.body?.name ?? "").trim().slice(0, 120);
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (email && !/^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/.test(email)) { bad(res, 400, "That doesn't look like a valid email address."); return; }
  await db.insert(portalSettingsTable).values({ key: "supplier", value: { name, email } })
    .onConflictDoUpdate({ target: portalSettingsTable.key, set: { value: { name, email } } });
  res.json({ name, email });
}));

// Importing the tags that already exist (before the portal). Status changes go through requests.
router.post("/portal/admin/tags", managerGuard, asyncRoute(async (req, res) => {
  const number = String(req.body?.number ?? "").trim();
  const clientId = req.body?.clientId ? String(req.body.clientId) : null;
  if (!number) { bad(res, 400, "Tag number required."); return; }
  if (clientId && !UUID.test(clientId)) { bad(res, 400, "Unknown client."); return; }
  const [dupe] = await db.select({ id: portalTagsTable.id }).from(portalTagsTable).where(eq(portalTagsTable.number, number));
  if (dupe) { bad(res, 409, "That tag number already exists."); return; }
  const [row] = await db.insert(portalTagsTable).values({ number, clientId, access: String(req.body?.access ?? "") }).returning();
  res.status(201).json(row);
}));

router.patch("/portal/admin/tags/:id", managerGuard, asyncRoute(async (req, res) => {
  const [row] = await db.update(portalTagsTable).set({ access: String(req.body?.access ?? "") }).where(eq(portalTagsTable.id, String(req.params.id))).returning();
  if (!row) { bad(res, 404, "Tag not found."); return; }
  res.json(row);
}));

// G3: manager-initiated requests (someone joins, leaves, or needs a replacement).
router.post("/portal/admin/tag-requests", managerGuard, asyncRoute(async (req, res) => {
  const { clientId, kind, note } = req.body ?? {};
  if (!UUID.test(String(clientId)) || !["new", "replace", "deactivate"].includes(kind)) { bad(res, 400, "Pick a client and a request type."); return; }
  const [active] = await db.select().from(portalTagsTable).where(and(eq(portalTagsTable.clientId, clientId), eq(portalTagsTable.status, "active"))).limit(1);
  if (kind !== "new" && !active) { bad(res, 400, "That client has no active tag."); return; }
  const [open] = await db.select({ id: portalTagRequestsTable.id }).from(portalTagRequestsTable)
    .where(and(eq(portalTagRequestsTable.clientId, clientId), inArray(portalTagRequestsTable.status, OPEN_REQ))).limit(1);
  if (open) { bad(res, 409, "That client already has a request in progress."); return; }
  const [row] = await db.insert(portalTagRequestsTable).values({ clientId, kind, oldTagId: kind === "new" ? null : active!.id, note: String(note ?? "") }).returning();
  res.status(201).json(row);
}));

router.post("/portal/admin/tag-requests/mark-sent", managerGuard, asyncRoute(async (req, res) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.map(String).filter((i: string) => UUID.test(i)) : [];
  if (!ids.length) { bad(res, 400, "Nothing selected."); return; }
  const rows = await db.update(portalTagRequestsTable).set({ status: "sent", updatedAt: new Date() })
    .where(and(inArray(portalTagRequestsTable.id, ids), eq(portalTagRequestsTable.status, "to_send"))).returning({ id: portalTagRequestsTable.id });
  res.json({ updated: rows.length });
}));

// The tag table changes only here, when the supplier has confirmed.
router.post("/portal/admin/tag-requests/:id/confirm", managerGuard, asyncRoute(async (req, res) => {
  const id = String(req.params.id);
  const out = await db.transaction(async (tx) => {
    const [r] = await tx.select().from(portalTagRequestsTable).where(eq(portalTagRequestsTable.id, id)).for("update");
    if (!r) return { error: "Request not found.", status: 404 };
    if (r.status !== "sent") return { error: "Mark the request as sent to the supplier before confirming it.", status: 409 };
    const tagNumber = String(req.body?.tagNumber ?? "").trim() || r.newTagNumber || "";
    if (r.kind !== "deactivate") {
      if (!tagNumber) return { error: "Enter the number of the new tag.", status: 400 };
      const [existing] = await tx.select().from(portalTagsTable).where(eq(portalTagsTable.number, tagNumber));
      if (existing && existing.clientId && existing.clientId !== r.clientId && existing.status === "active") return { error: "That tag is assigned to someone else.", status: 409 };
      if (existing && r.oldTagId === existing.id) return { error: "That is the old tag. Enter the new tag's number.", status: 400 };
      if (existing) await tx.update(portalTagsTable).set({ clientId: r.clientId, status: "active" }).where(eq(portalTagsTable.id, existing.id));
      else await tx.insert(portalTagsTable).values({ number: tagNumber, clientId: r.clientId, status: "active" });
    }
    if (r.oldTagId) await tx.update(portalTagsTable).set({ status: r.kind === "replace" ? "lost" : "disabled" }).where(eq(portalTagsTable.id, r.oldTagId));
    await tx.update(portalTagRequestsTable).set({ status: "confirmed", newTagNumber: r.kind === "deactivate" ? null : tagNumber, updatedAt: new Date() }).where(eq(portalTagRequestsTable.id, id));
    return { ok: true };
  });
  if (!("ok" in out)) { bad(res, out.status, out.error); return; }
  res.json({ ok: true });
}));

router.post("/portal/admin/tag-requests/:id/reject", managerGuard, asyncRoute(async (req, res) => {
  const rows = await db.update(portalTagRequestsTable).set({ status: "rejected", updatedAt: new Date() })
    .where(and(eq(portalTagRequestsTable.id, String(req.params.id)), inArray(portalTagRequestsTable.status, OPEN_REQ))).returning({ id: portalTagRequestsTable.id });
  if (!rows.length) { bad(res, 404, "No open request with that id."); return; }
  res.json({ ok: true });
}));

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
  const tags = await db.select().from(portalTagsTable).where(inArray(portalTagsTable.status, ["active", "pending"]));
  const open = await db.select().from(portalTagRequestsTable).where(inArray(portalTagRequestsTable.status, OPEN_REQ));
  res.json(users.map(({ u, company }) => ({
    id: u.id, email: u.email, name: u.name, role: u.role, kind: u.kind, companyId: u.companyId, company,
    hasPassword: !!u.passwordHash,
    tag: tags.find((t) => t.clientId === u.id && t.status === "active")?.number ?? null,
    pendingTag: open.find((r) => r.clientId === u.id)?.newTagNumber ?? null,
    hasOpenRequest: open.some((r) => r.clientId === u.id),
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

// ── Door codes ──────────────────────────────────────────────────────────────
const isUniqueViolation = (e: unknown) => { const x = e as { code?: string; cause?: { code?: string } }; return x?.code === "23505" || x?.cause?.code === "23505"; };
const CODE_TAKEN = "That code is already used by another tag. Pick a different one.";

router.put("/portal/admin/tags/:id/code", managerGuard, asyncRoute(async (req, res) => {
  const code = req.body?.code;
  if (!isValidCode(code)) { bad(res, 400, "A code is exactly 4 digits."); return; }
  const id = String(req.params.id);
  const [clash] = await db.select({ id: portalTagsTable.id }).from(portalTagsTable).where(eq(portalTagsTable.codeFp, codeFingerprint(code)));
  if (clash && clash.id !== id) { bad(res, 409, CODE_TAKEN); return; }
  try {
    const rows = await db.update(portalTagsTable).set({ codeEnc: encryptCode(code), codeFp: codeFingerprint(code) }).where(eq(portalTagsTable.id, id)).returning({ id: portalTagsTable.id });
    if (!rows.length) { bad(res, 404, "Tag not found."); return; }
  } catch (e) { if (isUniqueViolation(e)) { bad(res, 409, CODE_TAKEN); return; } throw e; }
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
  const [req] = await db.select().from(portalTagRequestsTable).where(and(eq(portalTagRequestsTable.clientId, user.id), inArray(portalTagRequestsTable.status, OPEN_REQ))).limit(1);
  const [own] = await db.select().from(portalTagsTable).where(and(eq(portalTagsTable.clientId, user.id), eq(portalTagsTable.status, "active"))).limit(1);
  const tag = own ?? (req?.newTagNumber ? (await db.select().from(portalTagsTable).where(eq(portalTagsTable.number, req.newTagNumber)))[0] : undefined);
  const mail = renderWelcome(await welcomeCopy(), { name: user.name, tag: tag?.number ?? "(not assigned yet)", code: tag?.codeEnc ? decryptCode(tag.codeEnc) : "(not set yet)", link });
  const { sent } = await sendMail({ to: user.email, ...mail });
  return { sent, preview: { to: user.email, ...mail }, devLink: process.env.NODE_ENV === "production" ? undefined : link };
}

router.post("/portal/admin/users/:id/invite", managerGuard, asyncRoute(async (req, res) => {
  const [user] = await db.select().from(portalClientsTable).where(eq(portalClientsTable.id, String(req.params.id)));
  if (!user) { bad(res, 404, "User not found."); return; }
  res.json(await inviteAndWelcome(user, String(req.body?.origin || "http://localhost:5174")));
}));

// Onboarding step 2-4: give the user a tag, choose the 4-digit code, and queue the change for Ricardo.
// The tag shows as "pending" until the supplier confirms; the user is linked through the request.
router.post("/portal/admin/users/:id/onboard", managerGuard, asyncRoute(async (req, res) => {
  const tagNumber = String(req.body?.tagNumber ?? "").trim().slice(0, 40);
  const code = req.body?.code;
  if (!tagNumber) { bad(res, 400, "Enter the tag number."); return; }
  if (!isValidCode(code)) { bad(res, 400, "A code is exactly 4 digits."); return; }
  const [user] = await db.select().from(portalClientsTable).where(eq(portalClientsTable.id, String(req.params.id)));
  if (!user) { bad(res, 404, "User not found."); return; }

  let out: { error: string; status: number } | { ok: true };
  try {
    out = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"tagreq:" + user.id}))`);
      const [open] = await tx.select({ id: portalTagRequestsTable.id }).from(portalTagRequestsTable).where(and(eq(portalTagRequestsTable.clientId, user.id), inArray(portalTagRequestsTable.status, OPEN_REQ))).limit(1);
      if (open) return { error: "This user already has a tag request in progress.", status: 409 };
      const [mine] = await tx.select({ id: portalTagsTable.id }).from(portalTagsTable).where(and(eq(portalTagsTable.clientId, user.id), eq(portalTagsTable.status, "active"))).limit(1);
      if (mine) return { error: "This user already has an active tag. Use \"change a tag\" instead.", status: 409 };
      const fp = codeFingerprint(code);
      const [clash] = await tx.select({ id: portalTagsTable.id, number: portalTagsTable.number }).from(portalTagsTable).where(eq(portalTagsTable.codeFp, fp));
      const [existing] = await tx.select().from(portalTagsTable).where(eq(portalTagsTable.number, tagNumber));
      if (clash && clash.id !== existing?.id) return { error: CODE_TAKEN, status: 409 };
      if (existing && !(existing.status === "spare" && !existing.clientId)) return { error: `Tag ${tagNumber} isn't a spare tag (it's ${existing.status}).`, status: 409 };
      const patch = { status: "pending", codeEnc: encryptCode(code), codeFp: fp };
      if (existing) await tx.update(portalTagsTable).set(patch).where(eq(portalTagsTable.id, existing.id));
      else await tx.insert(portalTagsTable).values({ number: tagNumber, clientId: null, ...patch });
      await tx.insert(portalTagRequestsTable).values({ clientId: user.id, kind: "new", newTagNumber: tagNumber, note: "Onboarding" });
      return { ok: true } as const;
    });
  } catch (e) { if (isUniqueViolation(e)) { bad(res, 409, CODE_TAKEN); return; } throw e; }
  if (!("ok" in out)) { bad(res, out.status, out.error); return; }
  const welcome = req.body?.sendWelcome === false ? null : await inviteAndWelcome(user, String(req.body?.origin || "http://localhost:5174"));
  res.status(201).json({ ok: true, welcome });
}));

// ── Inbox extras: everything that is waiting on the manager ─────────────────
router.get("/portal/inbox/todo", managerGuard, asyncRoute(async (_req, res) => {
  const reqs = await db.select({ r: portalTagRequestsTable, client: portalClientsTable.name, oldNumber: portalTagsTable.number })
    .from(portalTagRequestsTable).innerJoin(portalClientsTable, eq(portalClientsTable.id, portalTagRequestsTable.clientId))
    .leftJoin(portalTagsTable, eq(portalTagsTable.id, portalTagRequestsTable.oldTagId))
    .where(inArray(portalTagRequestsTable.status, OPEN_REQ)).orderBy(asc(portalTagRequestsTable.createdAt));
  res.json({ tagRequests: reqs.map(({ r, client, oldNumber }) => ({ ...r, client, oldNumber })) });
}));

router.get("/portal/inbox/count", managerGuard, asyncRoute(async (_req, res) => {
  const [{ n: items }] = await db.select({ n: sql<number>`count(*)::int` }).from(portalItemsTable).where(and(eq(portalItemsTable.status, "open"), sql`${portalItemsTable.claimedBy} is null`));
  const [{ n: tags }] = await db.select({ n: sql<number>`count(*)::int` }).from(portalTagRequestsTable).where(inArray(portalTagRequestsTable.status, OPEN_REQ));
  res.json({ pending: items + tags });
}));

export default router;
