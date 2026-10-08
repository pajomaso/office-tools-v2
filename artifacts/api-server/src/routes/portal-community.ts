import { Router, type IRouter } from "express";
import cookieParser from "cookie-parser";
import { db, portalAnnouncementsTable, portalPostsTable, portalLeadsTable, portalClientsTable } from "@workspace/db";
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
  res.json(rows.map(({ p, author }) => ({ id: p.id, body: p.body, createdAt: p.createdAt, author, mine: p.authorId === me.id, canDelete: p.authorId === me.id || me.role === "manager" })));
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
  const rows = await db.delete(portalPostsTable).where(and(eq(portalPostsTable.id, id), me.role === "manager" ? undefined : eq(portalPostsTable.authorId, me.id))).returning({ id: portalPostsTable.id });
  if (!rows.length) { bad(res, 404, "Post not found."); return; }
  res.json({ ok: true });
}));

// ── Public page: leads (no sign-in) ─────────────────────────────────────────
const hits = new Map<string, number[]>();
const LEADS_PER_HOUR_PER_IP = 5;

router.post("/portal/public/leads", asyncRoute(async (req, res) => {
  // Honeypot: real people never fill the hidden "website" field. Pretend it worked.
  if (String(req.body?.website ?? "")) { res.status(201).json({ ok: true }); return; }
  const ip = req.ip ?? "unknown";
  const recent = (hits.get(ip) ?? []).filter((t) => Date.now() - t < 3_600_000);
  if (recent.length >= LEADS_PER_HOUR_PER_IP) { bad(res, 429, "Too many requests. Please try again later."); return; }

  const name = String(req.body?.name ?? "").trim().slice(0, 120);
  const email = String(req.body?.email ?? "").trim().toLowerCase().slice(0, 200);
  if (!name || !/^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/.test(email)) { bad(res, 400, "Please add your name and a valid email."); return; }
  const interest = ["desk", "room", "other"].includes(req.body?.interest) ? req.body.interest : "other";
  hits.set(ip, [...recent, Date.now()]);
  await db.insert(portalLeadsTable).values({ name, email, interest, company: String(req.body?.company ?? "").trim().slice(0, 160), message: String(req.body?.message ?? "").trim().slice(0, 1000) });
  res.status(201).json({ ok: true });
}));

router.get("/portal/admin/leads", managerGuard, asyncRoute(async (_req, res) => {
  res.json(await db.select().from(portalLeadsTable).orderBy(desc(portalLeadsTable.createdAt)).limit(200));
}));

router.patch("/portal/admin/leads/:id", managerGuard, asyncRoute(async (req, res) => {
  const status = req.body?.status === "contacted" ? "contacted" : "new";
  const [row] = await db.update(portalLeadsTable).set({ status }).where(eq(portalLeadsTable.id, String(req.params.id))).returning();
  if (!row) { bad(res, 404, "Lead not found."); return; }
  res.json(row);
}));

export default router;
