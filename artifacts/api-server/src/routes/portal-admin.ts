import { Router, type IRouter, type RequestHandler } from "express";
import cookieParser from "cookie-parser";
import multer from "multer";
import {
  db,
  portalClientsTable,
  portalTagsTable,
  portalTagRequestsTable,
  portalInvoicesTable,
  portalReportsTable,
  portalSettingsTable,
  portalLeadsTable,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { asyncRoute, guard, managerGuard, type Authed } from "./portal";
import { partsOf } from "./portal-time";

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
  res.json({ tag: tags.find((t) => t.status === "active") ?? null, requests });
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
    tags: tags.map(({ t, client }) => ({ ...t, client })),
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
  const tagNumber = String(req.body?.tagNumber ?? "").trim();
  const out = await db.transaction(async (tx) => {
    const [r] = await tx.select().from(portalTagRequestsTable).where(eq(portalTagRequestsTable.id, id)).for("update");
    if (!r) return { error: "Request not found.", status: 404 };
    if (r.status !== "sent") return { error: "Mark the request as sent to the supplier before confirming it.", status: 409 };
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

// ── Clients + billing record ────────────────────────────────────────────────
const monthNow = () => partsOf(new Date()).month;

async function invoicesDue() {
  const month = monthNow();
  const billed = await db.select({ id: portalClientsTable.id, name: portalClientsTable.name }).from(portalClientsTable).where(sql`${portalClientsTable.priceCents} is not null`);
  const have = await db.select({ clientId: portalInvoicesTable.clientId }).from(portalInvoicesTable).where(eq(portalInvoicesTable.period, month));
  const done = new Set(have.map((h) => h.clientId));
  return billed.filter((c) => !done.has(c.id)).map((c) => ({ clientId: c.id, name: c.name, period: month }));
}

const optInt = (v: unknown) => (v === null || v === "" || v === undefined ? null : Number.isInteger(Number(v)) && Number(v) >= 0 ? Number(v) : NaN);
const optText = (v: unknown) => (v === null || v === undefined ? null : String(v).trim().slice(0, 300) || null);

router.get("/portal/admin/clients", managerGuard, asyncRoute(async (_req, res) => {
  const clients = await db.select().from(portalClientsTable).orderBy(asc(portalClientsTable.name));
  const tags = await db.select().from(portalTagsTable).where(eq(portalTagsTable.status, "active"));
  const invs = await db.select({ id: portalInvoicesTable.id, clientId: portalInvoicesTable.clientId, period: portalInvoicesTable.period, number: portalInvoicesTable.number, amountCents: portalInvoicesTable.amountCents, filename: portalInvoicesTable.filename, uploadedAt: portalInvoicesTable.uploadedAt })
    .from(portalInvoicesTable).orderBy(desc(portalInvoicesTable.period), desc(portalInvoicesTable.uploadedAt));
  const due = new Set((await invoicesDue()).map((d) => d.clientId));
  res.json(clients.map((c) => ({
    ...c,
    tag: tags.find((t) => t.clientId === c.id)?.number ?? null,
    invoices: invs.filter((i) => i.clientId === c.id),
    invoiceDue: due.has(c.id),
  })));
}));

router.post("/portal/admin/clients", managerGuard, asyncRoute(async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const name = String(req.body?.name ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) { bad(res, 400, "A name and a valid email are required."); return; }
  const desk = optInt(req.body?.deskDaysPerMonth), room = optInt(req.body?.roomDaysPerMonth);
  if (Number.isNaN(desk) || Number.isNaN(room)) { bad(res, 400, "Days must be whole numbers (or empty for no limit)."); return; }
  const [dupe] = await db.select({ id: portalClientsTable.id }).from(portalClientsTable).where(eq(portalClientsTable.email, email));
  if (dupe) { bad(res, 409, "A client with that email already exists."); return; }
  const [row] = await db.insert(portalClientsTable).values({ email, name, plan: String(req.body?.plan ?? "").trim() || "Members", deskDaysPerMonth: desk, roomDaysPerMonth: room }).returning();
  res.status(201).json(row);
}));

router.patch("/portal/admin/clients/:id", managerGuard, asyncRoute(async (req, res) => {
  const b = req.body ?? {};
  const set: Partial<typeof portalClientsTable.$inferInsert> = {};
  if ("name" in b) { const n = String(b.name).trim(); if (!n) { bad(res, 400, "Name can't be empty."); return; } set.name = n; }
  if ("plan" in b) set.plan = String(b.plan).trim() || "Members";
  for (const k of ["deskDaysPerMonth", "roomDaysPerMonth", "priceCents"] as const) {
    if (k in b) { const v = optInt(b[k]); if (Number.isNaN(v)) { bad(res, 400, "Days and price must be whole, non-negative numbers."); return; } set[k] = v; }
  }
  for (const k of ["legalName", "vatNumber", "billingAddress", "billingContact"] as const) if (k in b) set[k] = optText(b[k]);
  if (!Object.keys(set).length) { bad(res, 400, "Nothing to update."); return; }
  const [row] = await db.update(portalClientsTable).set(set).where(eq(portalClientsTable.id, String(req.params.id))).returning();
  if (!row) { bad(res, 404, "Client not found."); return; }
  res.json(row);
}));

// ── Invoices (issued manually elsewhere; PDFs are stored here) ──────────────
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

const uploadPdf: RequestHandler = (req, res, next) => {
  upload.single("file")(req, res, (err?: unknown) => (err ? bad(res, 400, (err as { code?: string }).code === "LIMIT_FILE_SIZE" ? "The PDF is over 5 MB." : "Upload failed.") : next()));
};

router.post("/portal/admin/clients/:id/invoices", managerGuard, uploadPdf, asyncRoute(async (req, res) => {
  const file = req.file;
  const period = String(req.body?.period ?? "");
  const number = String(req.body?.number ?? "").trim().slice(0, 60);
  const amount = req.body?.amount === undefined || req.body.amount === "" ? null : Math.round(Number(String(req.body.amount).replace(",", ".")) * 100);
  if (!file) { bad(res, 400, "Attach the invoice as a PDF."); return; }
  if (file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") { bad(res, 400, "Only PDF files are accepted."); return; }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) { bad(res, 400, "Pick the invoice month."); return; }
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) { bad(res, 400, "Amount must be a positive number."); return; }
  const [client] = await db.select({ id: portalClientsTable.id }).from(portalClientsTable).where(eq(portalClientsTable.id, String(req.params.id)));
  if (!client) { bad(res, 404, "Client not found."); return; }
  const filename = (file.originalname.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "invoice.pdf");
  try {
    const [row] = await db.insert(portalInvoicesTable).values({ clientId: client.id, period, number, amountCents: amount, filename, data: file.buffer })
      .returning({ id: portalInvoicesTable.id, period: portalInvoicesTable.period, number: portalInvoicesTable.number, filename: portalInvoicesTable.filename });
    res.status(201).json(row);
  } catch (e) {
    const code = (e as { code?: string; cause?: { code?: string } });
    if (code.code === "23505" || code.cause?.code === "23505") { bad(res, 409, "That invoice (month and number) is already uploaded."); return; }
    throw e;
  }
}));

router.delete("/portal/admin/invoices/:id", managerGuard, asyncRoute(async (req, res) => {
  const rows = await db.delete(portalInvoicesTable).where(eq(portalInvoicesTable.id, String(req.params.id))).returning({ id: portalInvoicesTable.id });
  if (!rows.length) { bad(res, 404, "Invoice not found."); return; }
  res.json({ ok: true });
}));

// I7: a client sees and downloads their own invoices.
router.get("/portal/invoices", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  res.json(await db.select({ id: portalInvoicesTable.id, period: portalInvoicesTable.period, number: portalInvoicesTable.number, amountCents: portalInvoicesTable.amountCents, filename: portalInvoicesTable.filename, uploadedAt: portalInvoicesTable.uploadedAt })
    .from(portalInvoicesTable).where(eq(portalInvoicesTable.clientId, me.id)).orderBy(desc(portalInvoicesTable.period), desc(portalInvoicesTable.uploadedAt)));
}));

router.get("/portal/invoices/:id/file", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const id = String(req.params.id);
  if (!UUID.test(id)) { bad(res, 404, "Invoice not found."); return; }
  const [inv] = await db.select().from(portalInvoicesTable).where(and(eq(portalInvoicesTable.id, id), me.role === "manager" ? undefined : eq(portalInvoicesTable.clientId, me.id)));
  if (!inv) { bad(res, 404, "Invoice not found."); return; }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${inv.filename.replace(/"/g, "")}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(inv.data);
}));

// ── Inbox extras: everything that is waiting on the manager ─────────────────
router.get("/portal/inbox/todo", managerGuard, asyncRoute(async (_req, res) => {
  const reqs = await db.select({ r: portalTagRequestsTable, client: portalClientsTable.name, oldNumber: portalTagsTable.number })
    .from(portalTagRequestsTable).innerJoin(portalClientsTable, eq(portalClientsTable.id, portalTagRequestsTable.clientId))
    .leftJoin(portalTagsTable, eq(portalTagsTable.id, portalTagRequestsTable.oldTagId))
    .where(inArray(portalTagRequestsTable.status, OPEN_REQ)).orderBy(asc(portalTagRequestsTable.createdAt));
  const [{ n: newLeads }] = await db.select({ n: sql<number>`count(*)::int` }).from(portalLeadsTable).where(eq(portalLeadsTable.status, "new"));
  res.json({ tagRequests: reqs.map(({ r, client, oldNumber }) => ({ ...r, client, oldNumber })), invoicesDue: await invoicesDue(), newLeads });
}));

router.get("/portal/inbox/count", managerGuard, asyncRoute(async (_req, res) => {
  const [{ n: reports }] = await db.select({ n: sql<number>`count(*)::int` }).from(portalReportsTable).where(inArray(portalReportsTable.status, ["open", "in_progress"]));
  const [{ n: tags }] = await db.select({ n: sql<number>`count(*)::int` }).from(portalTagRequestsTable).where(inArray(portalTagRequestsTable.status, OPEN_REQ));
  const due = (await invoicesDue()).length;
  const [{ n: leads }] = await db.select({ n: sql<number>`count(*)::int` }).from(portalLeadsTable).where(eq(portalLeadsTable.status, "new"));
  res.json({ pending: reports + tags + due + leads });
}));

export default router;
