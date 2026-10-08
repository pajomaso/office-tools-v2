import { Router, type IRouter } from "express";
import cookieParser from "cookie-parser";
import { db, portalItemsTable, portalItemFollowsTable, portalClientsTable } from "@workspace/db";
import { and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { asyncRoute, guard, managerGuard, type Authed } from "./portal";

const router: IRouter = Router();
router.use("/portal", cookieParser());

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (res: import("express").Response, status: number, error: string) => { res.status(status).json({ error }); };
const KINDS = ["issue", "request"], VISIBILITY = ["public", "private"], STATUSES = ["open", "claimed", "done"];
const DONE_VISIBLE_DAYS = 30;

const claimer = alias(portalClientsTable, "claimer");

async function loadItems(me: Authed["client"], where?: ReturnType<typeof and>) {
  const rows = await db.select({ i: portalItemsTable, author: portalClientsTable.name, claimedByName: claimer.name })
    .from(portalItemsTable)
    .innerJoin(portalClientsTable, eq(portalClientsTable.id, portalItemsTable.authorId))
    .leftJoin(claimer, eq(claimer.id, portalItemsTable.claimedBy))
    .where(where).orderBy(desc(portalItemsTable.createdAt)).limit(200);
  const ids = rows.map((r) => r.i.id);
  const follows = ids.length ? await db.select().from(portalItemFollowsTable).where(inArray(portalItemFollowsTable.itemId, ids)) : [];
  return rows.map(({ i, author, claimedByName }) => ({
    id: i.id, kind: i.kind, title: i.title, body: i.body, visibility: i.visibility, status: i.status, statusNote: i.statusNote,
    claimedBy: i.claimedBy, claimedByName, author, authorId: i.authorId, mine: i.authorId === me.id,
    following: follows.some((f) => f.itemId === i.id && f.userId === me.id), followers: follows.filter((f) => f.itemId === i.id).length,
    createdAt: i.createdAt, updatedAt: i.updatedAt,
  }));
}

// What this person may see: every public item, plus their own private ones. Admins see everything.
// "Done" items disappear from the list after a month.
router.get("/portal/items", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const recent = or(inArray(portalItemsTable.status, ["open", "claimed"]), gte(portalItemsTable.updatedAt, new Date(Date.now() - DONE_VISIBLE_DAYS * 86_400_000)));
  const visible = me.role === "admin" ? undefined : or(eq(portalItemsTable.visibility, "public"), eq(portalItemsTable.authorId, me.id));
  res.json(await loadItems(me, and(recent, visible)));
}));

router.post("/portal/items", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const { kind, visibility } = req.body ?? {};
  const title = String(req.body?.title ?? "").trim().slice(0, 140);
  if (!KINDS.includes(kind) || !VISIBILITY.includes(visibility) || !title) { bad(res, 400, "Add a title and choose the type and who can see it."); return; }
  const [row] = await db.insert(portalItemsTable).values({ authorId: me.id, kind, visibility, title, body: String(req.body?.body ?? "").trim().slice(0, 2000) }).returning();
  await db.insert(portalItemFollowsTable).values({ itemId: row!.id, userId: me.id }).onConflictDoNothing();
  res.status(201).json({ id: row!.id });
}));

// Following: public items only (private ones are only ever the author's and the admins').
router.post("/portal/items/:id/follow", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const id = String(req.params.id);
  if (!UUID.test(id)) { bad(res, 404, "Not found."); return; }
  const [it] = await db.select().from(portalItemsTable).where(eq(portalItemsTable.id, id));
  if (!it || (it.visibility === "private" && it.authorId !== me.id && me.role !== "admin")) { bad(res, 404, "Not found."); return; }
  await db.insert(portalItemFollowsTable).values({ itemId: id, userId: me.id }).onConflictDoNothing();
  res.json({ ok: true });
}));

router.delete("/portal/items/:id/follow", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const id = String(req.params.id);
  if (!UUID.test(id)) { bad(res, 404, "Not found."); return; }
  await db.delete(portalItemFollowsTable).where(and(eq(portalItemFollowsTable.itemId, id), eq(portalItemFollowsTable.userId, me.id)));
  res.json({ ok: true });
}));

// Admin: claim, unclaim, set status and the short status note ("called", "not called yet").
router.patch("/portal/admin/items/:id", managerGuard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const id = String(req.params.id);
  if (!UUID.test(id)) { bad(res, 404, "Item not found."); return; }
  const b = req.body ?? {};
  const set: Partial<typeof portalItemsTable.$inferInsert> = { updatedAt: new Date() };
  if (b.status !== undefined) { if (!STATUSES.includes(b.status)) { bad(res, 400, "Unknown status."); return; } set.status = b.status; }
  if (b.statusNote !== undefined) set.statusNote = String(b.statusNote).slice(0, 300);
  if (b.claim === true) { set.claimedBy = me.id; if (b.status === undefined) set.status = "claimed"; }
  if (b.claim === false) { set.claimedBy = null; if (b.status === undefined) set.status = "open"; }
  const [row] = await db.update(portalItemsTable).set(set).where(eq(portalItemsTable.id, id)).returning({ id: portalItemsTable.id });
  if (!row) { bad(res, 404, "Item not found."); return; }
  res.json({ ok: true });
}));

router.get("/portal/admin/items/unclaimed-count", managerGuard, asyncRoute(async (_req, res) => {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(portalItemsTable).where(and(eq(portalItemsTable.status, "open"), sql`${portalItemsTable.claimedBy} is null`));
  res.json({ n });
}));

export default router;
