import { Router, type IRouter } from "express";
import cookieParser from "cookie-parser";
import { randomBytes } from "node:crypto";
import {
  db, portalClientsTable, portalCompaniesTable, portalTagsTable, portalTagBatchesTable, portalTagChangesTable,
  portalTagLogTable, portalAdminSeenTable, portalSettingsTable,
} from "@workspace/db";
import { and, asc, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { asyncRoute, managerGuard, type Authed } from "./portal";
import { codeFingerprint, encryptCode, hashToken, isValidCode } from "./portal-crypto";
import { publicBase } from "./portal-config";

const router: IRouter = Router();
router.use("/portal", cookieParser());

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (res: import("express").Response, status: number, error: string) => { res.status(status).json({ error }); };

export type Tag = typeof portalTagsTable.$inferSelect;
type Change = typeof portalTagChangesTable.$inferSelect;
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Err = { error: string; status: number };

const LEVELS = ["user", "administrator", "service"];
const KINDS = ["assign", "reassign", "rename", "lost", "return"];
const LINK_DAYS = 14;

export const CODE_TAKEN = "That code is already used by another tag. Pick a different one.";
export const isUniqueViolation = (e: unknown) => { const x = e as { code?: string; cause?: { code?: string } }; return x?.code === "23505" || x?.cause?.code === "23505"; };

// ── The secret link ─────────────────────────────────────────────────────────
// 32 random bytes in the URL; only a SHA-256 hash is stored, so a database leak doesn't expose live links.
export const newLinkToken = () => randomBytes(32).toString("base64url");
export { hashToken };

export async function log(tx: Tx | typeof db, e: { tag?: Tag | null; tagNumber?: string; event: string; detail?: string; actor: string; bySupplier?: boolean; ip?: string | null }) {
  await tx.insert(portalTagLogTable).values({ tagId: e.tag?.id ?? null, tagNumber: e.tag?.number ?? e.tagNumber ?? "", event: e.event, detail: e.detail ?? "", actor: e.actor, bySupplier: !!e.bySupplier, ip: e.ip ?? null });
}

// ── Batches and change lines ────────────────────────────────────────────────
export async function openBatchId(tx: Tx, adminId: string | null): Promise<string> {
  await tx.insert(portalTagBatchesTable).values({ status: "open", createdBy: adminId }).onConflictDoNothing();
  const [b] = await tx.select({ id: portalTagBatchesTable.id }).from(portalTagBatchesTable).where(eq(portalTagBatchesTable.status, "open"));
  return b!.id;
}

const hasPendingLine = async (tx: Tx, tagId: string) => {
  const [p] = await tx.select({ id: portalTagChangesTable.id }).from(portalTagChangesTable).where(and(eq(portalTagChangesTable.tagId, tagId), eq(portalTagChangesTable.status, "pending"))).limit(1);
  return !!p;
};
const userBusy = async (tx: Tx, userId: string) => {
  const [t] = await tx.select({ id: portalTagsTable.id }).from(portalTagsTable).where(and(eq(portalTagsTable.clientId, userId), eq(portalTagsTable.status, "active"))).limit(1);
  if (t) return "That person already has an active tag.";
  const [p] = await tx.select({ id: portalTagChangesTable.id }).from(portalTagChangesTable)
    .where(and(eq(portalTagChangesTable.toUserId, userId), eq(portalTagChangesTable.status, "pending"), inArray(portalTagChangesTable.kind, ["assign", "reassign"]))).limit(1);
  return p ? "That person already has a tag change waiting for the supplier." : null;
};

// Adds one change to the open batch after checking the tag really is in the state the change assumes.
export async function addChange(tx: Tx, o: { tag: Tag; kind: string; toUserId?: string | null; newName?: string; note?: string; adminId: string | null }): Promise<{ id: string } | Err> {
  const { tag, kind } = o;
  if (!KINDS.includes(kind)) return { error: "Unknown change.", status: 400 };
  if (await hasPendingLine(tx, tag.id)) return { error: `Tag ${tag.number} already has a change waiting for the supplier.`, status: 409 };
  let toUser: typeof portalClientsTable.$inferSelect | undefined;
  if (kind === "assign" || kind === "reassign") {
    if (!o.toUserId || !UUID.test(o.toUserId)) return { error: "Choose who gets the tag.", status: 400 };
    [toUser] = await tx.select().from(portalClientsTable).where(eq(portalClientsTable.id, o.toUserId));
    if (!toUser) return { error: "That person doesn't exist.", status: 404 };
    if (toUser.deactivatedAt) return { error: `${toUser.name} is deactivated. Reactivate them first.`, status: 409 };
    const busy = await userBusy(tx, toUser.id);
    if (busy) return { error: busy, status: 409 };
  }
  const line: { fromUserId: string | null; toUserId: string | null; fromName: string; toName: string } = { fromUserId: tag.clientId, toUserId: null, fromName: tag.holderName, toName: "" };
  if (kind === "assign") {
    if (tag.status !== "spare" || tag.clientId) return { error: `Tag ${tag.number} isn't a spare tag.`, status: 409 };
    line.toUserId = toUser!.id; line.toName = toUser!.name;
  } else if (kind === "reassign") {
    if (tag.status !== "active" || !tag.clientId) return { error: `Tag ${tag.number} isn't assigned to anyone.`, status: 409 };
    if (tag.clientId === toUser!.id) return { error: "That person already has this tag.", status: 400 };
    line.toUserId = toUser!.id; line.toName = toUser!.name;
  } else if (kind === "rename") {
    const name = String(o.newName ?? "").trim().slice(0, 120);
    if (tag.status !== "active" || !tag.clientId) return { error: `Tag ${tag.number} isn't assigned to anyone.`, status: 409 };
    if (!name) return { error: "Enter the new name.", status: 400 };
    if (name === tag.holderName) return { error: "That is already the name on the tag.", status: 400 };
    line.toUserId = tag.clientId; line.toName = name;
  } else if (kind === "lost") {
    if (!["active", "blocked"].includes(tag.status)) return { error: `Tag ${tag.number} can't be marked lost (it's ${tag.status}).`, status: 409 };
  } else if (kind === "return") {
    if (tag.status !== "active") return { error: `Tag ${tag.number} isn't in use.`, status: 409 };
  }
  const batchId = await openBatchId(tx, o.adminId);
  const [row] = await tx.insert(portalTagChangesTable).values({ batchId, tagId: tag.id, kind, ...line, note: String(o.note ?? "").slice(0, 300), createdBy: o.adminId }).returning({ id: portalTagChangesTable.id });
  return { id: row!.id };
}

// Does the tag still look the way the change was written for? ("currently assigned to X")
function expected(tag: Tag, c: Change): boolean {
  switch (c.kind) {
    case "assign": return tag.status === "spare" && !tag.clientId;
    case "reassign": return tag.status === "active" && tag.clientId === c.fromUserId;
    case "rename": return tag.status === "active" && tag.clientId === c.fromUserId;
    case "lost": return ["active", "blocked"].includes(tag.status) && tag.clientId === c.fromUserId;
    case "return": return tag.status === "active" && tag.clientId === c.fromUserId;
    default: return false;
  }
}

// Applies one pending line to the tag record. This is the ONLY place a tag's owner or name changes.
export async function applyChange(tx: Tx, changeId: string, who: { actor: string; bySupplier: boolean; ip?: string | null }): Promise<"done" | "outdated" | "skipped"> {
  const [c] = await tx.select().from(portalTagChangesTable).where(eq(portalTagChangesTable.id, changeId)).for("update");
  if (!c || c.status !== "pending") return "skipped";
  const [tag] = await tx.select().from(portalTagsTable).where(eq(portalTagsTable.id, c.tagId)).for("update");
  if (!tag) return "skipped";
  const now = new Date();
  if (!expected(tag, c)) {
    await tx.update(portalTagChangesTable).set({ status: "outdated", doneAt: now, doneBy: who.actor, doneIp: who.ip ?? null }).where(eq(portalTagChangesTable.id, c.id));
    await log(tx, { tag, event: "line_outdated", detail: `${c.kind}: the tag no longer matches the request`, ...who });
    await closeBatchIfFinished(tx, c.batchId);
    return "outdated";
  }
  const patch: Partial<Tag> =
    c.kind === "assign" || c.kind === "reassign" ? { clientId: c.toUserId, holderName: c.toName, status: "active" }
    : c.kind === "rename" ? { holderName: c.toName }
    : c.kind === "lost" ? { clientId: null, holderName: "", status: "lost" }
    : { clientId: null, holderName: "", status: "spare" };
  if ((c.kind === "assign" || c.kind === "reassign") && c.toUserId && !tag.companyId) {
    const [u] = await tx.select({ companyId: portalClientsTable.companyId }).from(portalClientsTable).where(eq(portalClientsTable.id, c.toUserId));
    if (u?.companyId) patch.companyId = u.companyId;
  }
  await tx.update(portalTagsTable).set(patch).where(eq(portalTagsTable.id, tag.id));
  await tx.update(portalTagChangesTable).set({ status: "done", doneAt: now, doneBy: who.actor, doneIp: who.ip ?? null, prevUserId: tag.clientId, prevStatus: tag.status, prevHolderName: tag.holderName }).where(eq(portalTagChangesTable.id, c.id));
  await log(tx, { tag, event: "line_done", detail: describe(c), ...who });
  await closeBatchIfFinished(tx, c.batchId);
  return "done";
}

export const describe = (c: Pick<Change, "kind" | "fromName" | "toName">) =>
  c.kind === "assign" ? `assigned to ${c.toName}` : c.kind === "reassign" ? `${c.fromName} → ${c.toName}` : c.kind === "rename" ? `renamed ${c.fromName} → ${c.toName}`
  : c.kind === "lost" ? `marked lost${c.fromName ? ` (was ${c.fromName})` : ""}` : `returned${c.fromName ? ` by ${c.fromName}` : ""}, now spare`;

async function closeBatchIfFinished(tx: Tx, batchId: string) {
  const [open] = await tx.select({ id: portalTagChangesTable.id }).from(portalTagChangesTable).where(and(eq(portalTagChangesTable.batchId, batchId), eq(portalTagChangesTable.status, "pending"))).limit(1);
  const [b] = await tx.select().from(portalTagBatchesTable).where(eq(portalTagBatchesTable.id, batchId));
  if (b && b.status === "sent" && !open) await tx.update(portalTagBatchesTable).set({ status: "done" }).where(eq(portalTagBatchesTable.id, batchId));
}

// ── Admin: tags ─────────────────────────────────────────────────────────────
const lineShape = (c: Change, tagNumber: string) => ({ id: c.id, tagId: c.tagId, tagNumber, kind: c.kind, fromName: c.fromName, toName: c.toName, status: c.status, note: c.note, doneAt: c.doneAt, doneBy: c.doneBy });

router.get("/portal/admin/tags", managerGuard, asyncRoute(async (_req, res) => {
  const tags = await db.select({ t: portalTagsTable, user: portalClientsTable.name, company: portalCompaniesTable.name }).from(portalTagsTable)
    .leftJoin(portalClientsTable, eq(portalClientsTable.id, portalTagsTable.clientId)).leftJoin(portalCompaniesTable, eq(portalCompaniesTable.id, portalTagsTable.companyId)).orderBy(asc(portalTagsTable.number));
  const lines = await db.select({ c: portalTagChangesTable, number: portalTagsTable.number, bStatus: portalTagBatchesTable.status }).from(portalTagChangesTable)
    .innerJoin(portalTagsTable, eq(portalTagsTable.id, portalTagChangesTable.tagId)).innerJoin(portalTagBatchesTable, eq(portalTagBatchesTable.id, portalTagChangesTable.batchId))
    .where(ne(portalTagChangesTable.status, "removed")).orderBy(asc(portalTagChangesTable.createdAt));
  const batches = await db.select().from(portalTagBatchesTable).orderBy(desc(portalTagBatchesTable.createdAt)).limit(12);
  const supplier = (await db.select().from(portalSettingsTable).where(eq(portalSettingsTable.key, "supplier")))[0]?.value ?? {};
  const now = new Date();
  const batchShape = (b: (typeof batches)[number]) => {
    const ls = lines.filter((l) => l.c.batchId === b.id).map((l) => lineShape(l.c, l.number));
    return { id: b.id, status: b.status, createdAt: b.createdAt, sentAt: b.sentAt, expiresAt: b.linkExpiresAt, linkActive: !!b.linkHash && !b.revokedAt && !!b.linkExpiresAt && b.linkExpiresAt > now, revoked: !!b.revokedAt, lines: ls };
  };
  res.json({
    tags: tags.map(({ t, user, company }) => {
      const pending = lines.find((l) => l.c.tagId === t.id && l.c.status === "pending");
      return {
        id: t.id, number: t.number, status: pending ? "pending" : t.status, baseStatus: t.status, holderName: t.holderName, clientId: t.clientId, user, level: t.accessLevel, note: t.note,
        companyId: t.companyId, company, hasCode: !!t.codeEnc, pending: pending ? { changeId: pending.c.id, kind: pending.c.kind, toName: pending.c.toName, batchStatus: pending.bStatus } : null,
      };
    }),
    open: batches.filter((b) => b.status === "open").map(batchShape)[0] ?? null,
    sent: batches.filter((b) => b.status !== "open").map(batchShape),
    supplier,
  });
}));

// Record a tag that already exists (or a brand new spare one). This is bookkeeping of the current state, not a change for the supplier.
router.post("/portal/admin/tags", managerGuard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const number = String(req.body?.number ?? "").trim().slice(0, 40);
  const userId = req.body?.userId ? String(req.body.userId) : null;
  const level = LEVELS.includes(req.body?.accessLevel) ? req.body.accessLevel : "user";
  if (!number) { bad(res, 400, "Enter the tag number."); return; }
  if (userId && !UUID.test(userId)) { bad(res, 400, "Unknown person."); return; }
  const out = await db.transaction(async (tx) => {
    const [dupe] = await tx.select({ id: portalTagsTable.id }).from(portalTagsTable).where(eq(portalTagsTable.number, number));
    if (dupe) return { error: "That tag number already exists.", status: 409 } as Err;
    let holder = "", companyId: string | null = req.body?.companyId && UUID.test(String(req.body.companyId)) ? String(req.body.companyId) : null;
    if (userId) {
      const [u] = await tx.select().from(portalClientsTable).where(eq(portalClientsTable.id, userId));
      if (!u) return { error: "That person doesn't exist.", status: 404 } as Err;
      const busy = await userBusy(tx, u.id);
      if (busy) return { error: busy, status: 409 } as Err;
      holder = String(req.body?.holderName ?? "").trim() || u.name; companyId = companyId ?? u.companyId;
    }
    const [row] = await tx.insert(portalTagsTable).values({ number, clientId: userId, holderName: holder, status: userId ? "active" : "spare", accessLevel: level, companyId, note: String(req.body?.note ?? "").slice(0, 300) }).returning();
    await log(tx, { tag: row, event: "tag_recorded", detail: userId ? `recorded as assigned to ${holder}` : "recorded as spare", actor: me.name });
    return { id: row!.id };
  });
  if ("error" in out) { bad(res, out.status, out.error); return; }
  res.status(201).json(out);
}));

// Edits that don't go through the supplier: level, note, company, and blocking/unblocking.
router.patch("/portal/admin/tags/:id", managerGuard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const id = String(req.params.id);
  if (!UUID.test(id)) { bad(res, 404, "Tag not found."); return; }
  const b = req.body ?? {};
  const out = await db.transaction(async (tx) => {
    const [tag] = await tx.select().from(portalTagsTable).where(eq(portalTagsTable.id, id)).for("update");
    if (!tag) return { error: "Tag not found.", status: 404 } as Err;
    const set: Partial<Tag> = {}; const notes: string[] = [];
    if (b.accessLevel !== undefined) { if (!LEVELS.includes(b.accessLevel)) return { error: "Unknown access level.", status: 400 } as Err; set.accessLevel = b.accessLevel; notes.push(`level ${b.accessLevel}`); }
    if (b.note !== undefined) set.note = String(b.note).slice(0, 300);
    if (b.companyId !== undefined) set.companyId = b.companyId && UUID.test(String(b.companyId)) ? String(b.companyId) : null;
    if (b.status !== undefined) {
      if (!["active", "blocked"].includes(b.status) || !["active", "blocked"].includes(tag.status)) return { error: "A tag can only be blocked or unblocked while it's in use.", status: 409 } as Err;
      if (await hasPendingLine(tx, tag.id)) return { error: "Finish the change waiting for the supplier first.", status: 409 } as Err;
      set.status = b.status; notes.push(b.status === "blocked" ? "blocked" : "unblocked");
    }
    if (!Object.keys(set).length) return { error: "Nothing to change.", status: 400 } as Err;
    await tx.update(portalTagsTable).set(set).where(eq(portalTagsTable.id, id));
    if (notes.length) await log(tx, { tag, event: b.status !== undefined ? "status_changed" : "tag_edited", detail: notes.join(", "), actor: me.name });
    return { ok: true };
  });
  if ("error" in out) { bad(res, out.status, out.error); return; }
  res.json({ ok: true });
}));

router.put("/portal/admin/tags/:id/code", managerGuard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const code = req.body?.code;
  if (!isValidCode(code)) { bad(res, 400, "A code is exactly 4 digits."); return; }
  const id = String(req.params.id);
  if (!UUID.test(id)) { bad(res, 404, "Tag not found."); return; }
  const [clash] = await db.select({ id: portalTagsTable.id }).from(portalTagsTable).where(eq(portalTagsTable.codeFp, codeFingerprint(code)));
  if (clash && clash.id !== id) { bad(res, 409, CODE_TAKEN); return; }
  try {
    const rows = await db.update(portalTagsTable).set({ codeEnc: encryptCode(code), codeFp: codeFingerprint(code) }).where(eq(portalTagsTable.id, id)).returning();
    if (!rows.length) { bad(res, 404, "Tag not found."); return; }
    await log(db, { tag: rows[0], event: "code_changed", detail: "code changed", actor: me.name }); // the code itself is never logged
  } catch (e) { if (isUniqueViolation(e)) { bad(res, 409, CODE_TAKEN); return; } throw e; }
  res.json({ ok: true });
}));

// ── Admin: changes and batches ──────────────────────────────────────────────
router.post("/portal/admin/tags/:id/changes", managerGuard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const id = String(req.params.id);
  if (!UUID.test(id)) { bad(res, 404, "Tag not found."); return; }
  const out = await db.transaction(async (tx) => {
    const [tag] = await tx.select().from(portalTagsTable).where(eq(portalTagsTable.id, id)).for("update");
    if (!tag) return { error: "Tag not found.", status: 404 } as Err;
    const r = await addChange(tx, { tag, kind: String(req.body?.kind), toUserId: req.body?.userId ? String(req.body.userId) : null, newName: req.body?.name, note: req.body?.note, adminId: me.id });
    if ("id" in r) await log(tx, { tag, event: "change_added", detail: `${String(req.body?.kind)} added to the pending batch`, actor: me.name });
    return r;
  });
  if ("error" in out) { bad(res, out.status, out.error); return; }
  res.status(201).json(out);
}));

// A line can be taken back only while its batch is still open (not yet sent).
router.delete("/portal/admin/changes/:id", managerGuard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const id = String(req.params.id);
  if (!UUID.test(id)) { bad(res, 404, "Change not found."); return; }
  const rows = await db.update(portalTagChangesTable).set({ status: "removed" })
    .where(and(eq(portalTagChangesTable.id, id), eq(portalTagChangesTable.status, "pending"), sql`${portalTagChangesTable.batchId} in (select id from portal_tag_batches where status = 'open')`)).returning();
  if (!rows.length) { bad(res, 409, "Only changes in the pending batch can be removed. A sent change has to be finished or undone."); return; }
  const [tag] = await db.select().from(portalTagsTable).where(eq(portalTagsTable.id, rows[0]!.tagId));
  await log(db, { tag, event: "change_removed", detail: describe(rows[0]!), actor: me.name });
  res.json({ ok: true });
}));

const linkFor = (origin: string, token: string) => `${publicBase(origin)}/access/${token}`;
const messageFor = (link: string) => `Ricardo, here's a new request: ${link}`;

async function issueLink(tx: Tx, batchId: string, adminId: string) {
  const token = newLinkToken();
  await tx.update(portalTagBatchesTable).set({ linkHash: hashToken(token), linkExpiresAt: new Date(Date.now() + LINK_DAYS * 86_400_000), revokedAt: null, sentBy: adminId }).where(eq(portalTagBatchesTable.id, batchId));
  return token;
}

router.post("/portal/admin/tag-batches/send", managerGuard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const origin = String(req.body?.origin || "http://localhost:5174");
  const out = await db.transaction(async (tx) => {
    const [b] = await tx.select().from(portalTagBatchesTable).where(eq(portalTagBatchesTable.status, "open")).for("update");
    const [line] = b ? await tx.select({ id: portalTagChangesTable.id }).from(portalTagChangesTable).where(and(eq(portalTagChangesTable.batchId, b.id), eq(portalTagChangesTable.status, "pending"))).limit(1) : [];
    if (!b || !line) return { error: "There's nothing in the pending batch to send.", status: 409 } as Err;
    const token = await issueLink(tx, b.id, me.id);
    await tx.update(portalTagBatchesTable).set({ status: "sent", sentAt: new Date() }).where(eq(portalTagBatchesTable.id, b.id));
    await log(tx, { tagNumber: "", event: "batch_sent", detail: "pending batch sent to the supplier", actor: me.name });
    return { batchId: b.id, token };
  });
  if ("error" in out) { bad(res, out.status, out.error); return; }
  const link = linkFor(origin, out.token);
  res.status(201).json({ batchId: out.batchId, link, message: messageFor(link) });
}));

// The link itself is never stored, so to get it again an admin makes a new one (the old one stops working).
router.post("/portal/admin/tag-batches/:id/regenerate-link", managerGuard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const id = String(req.params.id);
  if (!UUID.test(id)) { bad(res, 404, "Batch not found."); return; }
  const out = await db.transaction(async (tx) => {
    const [b] = await tx.select().from(portalTagBatchesTable).where(eq(portalTagBatchesTable.id, id)).for("update");
    if (!b || b.status === "open") return { error: "Batch not found, or it hasn't been sent yet.", status: 404 } as Err;
    const token = await issueLink(tx, id, me.id);
    await log(tx, { tagNumber: "", event: "link_regenerated", detail: "new supplier link created; the old one no longer works", actor: me.name });
    return { token };
  });
  if ("error" in out) { bad(res, out.status, out.error); return; }
  const link = linkFor(String(req.body?.origin || "http://localhost:5174"), out.token);
  res.json({ link, message: messageFor(link) });
}));

router.post("/portal/admin/tag-batches/:id/revoke-link", managerGuard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const id = String(req.params.id);
  if (!UUID.test(id)) { bad(res, 404, "Batch not found."); return; }
  const rows = await db.update(portalTagBatchesTable).set({ linkHash: null, revokedAt: new Date() }).where(and(eq(portalTagBatchesTable.id, id), ne(portalTagBatchesTable.status, "open"))).returning({ id: portalTagBatchesTable.id });
  if (!rows.length) { bad(res, 404, "Batch not found."); return; }
  await log(db, { tagNumber: "", event: "link_revoked", detail: "supplier link revoked", actor: me.name });
  res.json({ ok: true });
}));

// Fallback when the supplier answers by email instead of using the page: an admin marks the line done (recorded as the admin).
router.post("/portal/admin/changes/:id/done", managerGuard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const id = String(req.params.id);
  if (!UUID.test(id)) { bad(res, 404, "Change not found."); return; }
  const r = await db.transaction(async (tx) => {
    const [c] = await tx.select({ s: portalTagBatchesTable.status }).from(portalTagChangesTable).innerJoin(portalTagBatchesTable, eq(portalTagBatchesTable.id, portalTagChangesTable.batchId)).where(eq(portalTagChangesTable.id, id));
    if (!c || c.s === "open") return "not-sent" as const;
    return applyChange(tx, id, { actor: `${me.name} (admin)`, bySupplier: false });
  });
  if (r === "not-sent") { bad(res, 409, "Send the batch first."); return; }
  if (r === "skipped") { bad(res, 404, "That change is already finished."); return; }
  res.json({ result: r });
}));

// Undo a "Done" (e.g. clicked by mistake): puts the tag back as it was, as long as nobody has changed it since.
router.post("/portal/admin/changes/:id/reopen", managerGuard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const id = String(req.params.id);
  if (!UUID.test(id)) { bad(res, 404, "Change not found."); return; }
  const out = await db.transaction(async (tx) => {
    const [c] = await tx.select().from(portalTagChangesTable).where(eq(portalTagChangesTable.id, id)).for("update");
    if (!c || c.status !== "done") return { error: "Only finished changes can be reopened.", status: 409 } as Err;
    const [tag] = await tx.select().from(portalTagsTable).where(eq(portalTagsTable.id, c.tagId)).for("update");
    const after = c.kind === "assign" || c.kind === "reassign" ? tag?.clientId === c.toUserId && tag.holderName === c.toName
      : c.kind === "rename" ? tag?.holderName === c.toName : c.kind === "lost" ? tag?.status === "lost" : tag?.status === "spare";
    if (!tag || !after) return { error: "The tag has changed since, so this can't be undone safely.", status: 409 } as Err;
    if (await hasPendingLine(tx, tag.id)) return { error: "The tag has another change waiting.", status: 409 } as Err;
    await tx.update(portalTagsTable).set({ clientId: c.prevUserId, status: c.prevStatus ?? tag.status, holderName: c.prevHolderName ?? "" }).where(eq(portalTagsTable.id, tag.id));
    await tx.update(portalTagChangesTable).set({ status: "pending", doneAt: null, doneBy: null, doneIp: null }).where(eq(portalTagChangesTable.id, id));
    await tx.update(portalTagBatchesTable).set({ status: "sent" }).where(and(eq(portalTagBatchesTable.id, c.batchId), eq(portalTagBatchesTable.status, "done")));
    await log(tx, { tag, event: "line_reopened", detail: describe(c), actor: me.name });
    return { ok: true };
  });
  if ("error" in out) { bad(res, out.status, out.error); return; }
  res.json({ ok: true });
}));

// ── Admin: log and notifications ────────────────────────────────────────────
router.get("/portal/admin/tag-log", managerGuard, asyncRoute(async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 60));
  res.json(await db.select().from(portalTagLogTable).orderBy(desc(portalTagLogTable.createdAt)).limit(limit));
}));

async function unreadFor(adminId: string) {
  const [seen] = await db.select().from(portalAdminSeenTable).where(eq(portalAdminSeenTable.adminId, adminId));
  const since = seen?.seenAt ?? new Date(Date.now() - 30 * 86_400_000);
  return db.select().from(portalTagLogTable).where(and(eq(portalTagLogTable.bySupplier, true), gt(portalTagLogTable.createdAt, since))).orderBy(desc(portalTagLogTable.createdAt)).limit(50);
}

router.get("/portal/admin/tag-notifications", managerGuard, asyncRoute(async (req, res) => {
  const rows = await unreadFor((req as Authed).client.id);
  res.json({ unread: rows.length, items: rows.slice(0, 10).map((r) => ({ id: r.id, tagNumber: r.tagNumber, event: r.event, detail: r.detail, actor: r.actor, createdAt: r.createdAt })) });
}));

router.post("/portal/admin/tag-notifications/seen", managerGuard, asyncRoute(async (req, res) => {
  const adminId = (req as Authed).client.id;
  await db.insert(portalAdminSeenTable).values({ adminId }).onConflictDoUpdate({ target: portalAdminSeenTable.adminId, set: { seenAt: new Date() } });
  res.json({ ok: true });
}));

router.put("/portal/admin/supplier", managerGuard, asyncRoute(async (req, res) => {
  const name = String(req.body?.name ?? "").trim().slice(0, 120);
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (email && !/^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/.test(email)) { bad(res, 400, "That doesn't look like a valid email address."); return; }
  await db.insert(portalSettingsTable).values({ key: "supplier", value: { name, email } }).onConflictDoUpdate({ target: portalSettingsTable.key, set: { value: { name, email } } });
  res.json({ name, email });
}));

export async function inboxTagCounts(adminId: string) {
  const [{ n: pending }] = await db.select({ n: sql<number>`count(*)::int` }).from(portalTagChangesTable).innerJoin(portalTagBatchesTable, eq(portalTagBatchesTable.id, portalTagChangesTable.batchId))
    .where(and(eq(portalTagChangesTable.status, "pending"), eq(portalTagBatchesTable.status, "open")));
  return { openLines: pending, unread: (await unreadFor(adminId)).length };
}

export default router;
