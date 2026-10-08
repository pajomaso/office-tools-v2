import { Router, type IRouter } from "express";
import cookieParser from "cookie-parser";
import { db, portalMessagesTable, portalClientsTable } from "@workspace/db";
import { and, desc, eq, gt, gte, lte, sql } from "drizzle-orm";
import { asyncRoute, guard, type Authed } from "./portal";

const router: IRouter = Router();
router.use("/portal", cookieParser());

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (res: import("express").Response, status: number, error: string) => { res.status(status).json({ error }); };
const DEFAULT_DAYS = 7, MAX_DAYS = 90, POSTS_PER_HOUR = 5;
const expiry = (days: unknown) => {
  const d = Number(days ?? DEFAULT_DAYS);
  return Number.isInteger(d) && d >= 1 && d <= MAX_DAYS ? new Date(Date.now() + d * 86_400_000) : null;
};

const shape = (m: typeof portalMessagesTable.$inferSelect, author: string, me: Authed["client"]) => ({
  id: m.id, body: m.body, pinned: m.pinned, author, createdAt: m.createdAt, editedAt: m.editedAt, expiresAt: m.expiresAt,
  mine: m.authorId === me.id, canEdit: m.authorId === me.id, canDelete: m.authorId === me.id || me.role === "admin", canPin: me.role === "admin",
});

// Current = not expired, or pinned (pinned messages stay until unpinned). Past = expired, newest first.
router.get("/portal/messages", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const now = new Date();
  const base = db.select({ m: portalMessagesTable, author: portalClientsTable.name }).from(portalMessagesTable)
    .innerJoin(portalClientsTable, eq(portalClientsTable.id, portalMessagesTable.authorId));
  const current = await base.where(sql`${portalMessagesTable.pinned} or ${portalMessagesTable.expiresAt} > ${now}`)
    .orderBy(desc(portalMessagesTable.pinned), desc(portalMessagesTable.createdAt)).limit(100);
  const past = await db.select({ m: portalMessagesTable, author: portalClientsTable.name }).from(portalMessagesTable)
    .innerJoin(portalClientsTable, eq(portalClientsTable.id, portalMessagesTable.authorId))
    .where(and(eq(portalMessagesTable.pinned, false), lte(portalMessagesTable.expiresAt, now))).orderBy(desc(portalMessagesTable.createdAt)).limit(50);
  res.json({ current: current.map((r) => shape(r.m, r.author, me)), past: past.map((r) => shape(r.m, r.author, me)) });
}));

router.post("/portal/messages", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const body = String(req.body?.body ?? "").trim();
  if (!body) { bad(res, 400, "Write something first."); return; }
  if (body.length > 1000) { bad(res, 400, "Keep it under 1000 characters."); return; }
  const expiresAt = expiry(req.body?.days);
  if (!expiresAt) { bad(res, 400, `Choose between 1 and ${MAX_DAYS} days.`); return; }
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(portalMessagesTable)
    .where(and(eq(portalMessagesTable.authorId, me.id), gte(portalMessagesTable.createdAt, new Date(Date.now() - 3_600_000))));
  if (n >= POSTS_PER_HOUR) { bad(res, 429, `You can post ${POSTS_PER_HOUR} messages an hour. Try again a bit later.`); return; }
  const [row] = await db.insert(portalMessagesTable).values({ authorId: me.id, body, expiresAt }).returning({ id: portalMessagesTable.id });
  res.status(201).json(row);
}));

// Edit your own message (text and/or how long it stays). Admins pin and unpin any message.
router.patch("/portal/messages/:id", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const id = String(req.params.id);
  if (!UUID.test(id)) { bad(res, 404, "Message not found."); return; }
  const [m] = await db.select().from(portalMessagesTable).where(eq(portalMessagesTable.id, id));
  if (!m) { bad(res, 404, "Message not found."); return; }
  const set: Partial<typeof portalMessagesTable.$inferInsert> = {};
  if (req.body?.pinned !== undefined) {
    if (me.role !== "admin") { bad(res, 403, "Only admins can pin messages."); return; }
    set.pinned = !!req.body.pinned;
  }
  if (req.body?.body !== undefined || req.body?.days !== undefined) {
    if (m.authorId !== me.id) { bad(res, 403, "You can only edit your own messages."); return; }
    if (req.body.body !== undefined) {
      const body = String(req.body.body).trim();
      if (!body || body.length > 1000) { bad(res, 400, "The message must be 1 to 1000 characters."); return; }
      set.body = body; set.editedAt = new Date();
    }
    if (req.body.days !== undefined) { const e = expiry(req.body.days); if (!e) { bad(res, 400, `Choose between 1 and ${MAX_DAYS} days.`); return; } set.expiresAt = e; }
  }
  if (!Object.keys(set).length) { bad(res, 400, "Nothing to change."); return; }
  await db.update(portalMessagesTable).set(set).where(eq(portalMessagesTable.id, id));
  res.json({ ok: true });
}));

router.delete("/portal/messages/:id", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const id = String(req.params.id);
  if (!UUID.test(id)) { bad(res, 404, "Message not found."); return; }
  const rows = await db.delete(portalMessagesTable).where(and(eq(portalMessagesTable.id, id), me.role === "admin" ? undefined : eq(portalMessagesTable.authorId, me.id))).returning({ id: portalMessagesTable.id });
  if (!rows.length) { bad(res, 404, "Message not found."); return; }
  res.json({ ok: true });
}));

void gt;
export default router;
