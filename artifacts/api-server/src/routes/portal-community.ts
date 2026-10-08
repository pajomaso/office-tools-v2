import { Router, type IRouter } from "express";
import cookieParser from "cookie-parser";
import { db, portalAnnouncementsTable, portalPostsTable, portalClientsTable } from "@workspace/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { asyncRoute, guard, managerGuard, type Authed } from "./portal";

const router: IRouter = Router();
router.use("/portal", cookieParser());

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (res: import("express").Response, status: number, error: string) => { res.status(status).json({ error }); };
const POSTS_PER_HOUR = 5;

// ── Announcements: manager -> everyone ──────────────────────────────────────
router.get("/portal/announcements", guard, asyncRoute(async (_req, res) => {
  const rows = await db.select({ a: portalAnnouncementsTable, author: portalClientsTable.name })
    .from(portalAnnouncementsTable).innerJoin(portalClientsTable, eq(portalClientsTable.id, portalAnnouncementsTable.authorId))
    .orderBy(desc(portalAnnouncementsTable.pinned), desc(portalAnnouncementsTable.createdAt)).limit(50);
  res.json(rows.map(({ a, author }) => ({ id: a.id, title: a.title, body: a.body, pinned: a.pinned, createdAt: a.createdAt, author })));
}));

router.post("/portal/announcements", managerGuard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const title = String(req.body?.title ?? "").trim().slice(0, 140);
  if (!title) { bad(res, 400, "Give the announcement a title."); return; }
  const [row] = await db.insert(portalAnnouncementsTable)
    .values({ authorId: me.id, title, body: String(req.body?.body ?? "").trim().slice(0, 2000), pinned: !!req.body?.pinned }).returning();
  res.status(201).json(row);
}));

router.patch("/portal/announcements/:id", managerGuard, asyncRoute(async (req, res) => {
  const [row] = await db.update(portalAnnouncementsTable).set({ pinned: !!req.body?.pinned }).where(eq(portalAnnouncementsTable.id, String(req.params.id))).returning();
  if (!row) { bad(res, 404, "Announcement not found."); return; }
  res.json(row);
}));

router.delete("/portal/announcements/:id", managerGuard, asyncRoute(async (req, res) => {
  const rows = await db.delete(portalAnnouncementsTable).where(eq(portalAnnouncementsTable.id, String(req.params.id))).returning({ id: portalAnnouncementsTable.id });
  if (!rows.length) { bad(res, 404, "Announcement not found."); return; }
  res.json({ ok: true });
}));

// ── Community board: everyone -> everyone, light moderation ─────────────────
router.get("/portal/posts", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const rows = await db.select({ p: portalPostsTable, author: portalClientsTable.name })
    .from(portalPostsTable).innerJoin(portalClientsTable, eq(portalClientsTable.id, portalPostsTable.authorId))
    .orderBy(desc(portalPostsTable.createdAt)).limit(50);
  res.json(rows.map(({ p, author }) => ({ id: p.id, body: p.body, createdAt: p.createdAt, author, mine: p.authorId === me.id, canDelete: p.authorId === me.id || me.role === "admin" })));
}));

router.post("/portal/posts", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const body = String(req.body?.body ?? "").trim();
  if (!body) { bad(res, 400, "Write something first."); return; }
  if (body.length > 500) { bad(res, 400, "Keep it under 500 characters."); return; }
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(portalPostsTable)
    .where(and(eq(portalPostsTable.authorId, me.id), gte(portalPostsTable.createdAt, new Date(Date.now() - 3_600_000))));
  if (n >= POSTS_PER_HOUR) { bad(res, 429, `You can post ${POSTS_PER_HOUR} times an hour. Try again a bit later.`); return; }
  const [row] = await db.insert(portalPostsTable).values({ authorId: me.id, body }).returning();
  res.status(201).json(row);
}));

router.delete("/portal/posts/:id", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const id = String(req.params.id);
  if (!UUID.test(id)) { bad(res, 404, "Post not found."); return; }
  const rows = await db.delete(portalPostsTable).where(and(eq(portalPostsTable.id, id), me.role === "admin" ? undefined : eq(portalPostsTable.authorId, me.id))).returning({ id: portalPostsTable.id });
  if (!rows.length) { bad(res, 404, "Post not found."); return; }
  res.json({ ok: true });
}));

export default router;
