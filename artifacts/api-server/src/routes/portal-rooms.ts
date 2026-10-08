import { Router, type IRouter, type RequestHandler } from "express";
import cookieParser from "cookie-parser";
import multer from "multer";
import { db, portalRoomsTable, portalRoomPhotosTable, portalBookingsTable, portalBlocksTable, portalClientsTable } from "@workspace/db";
import { and, asc, eq, gt, gte, isNull, lt, ne, or, sql } from "drizzle-orm";
import { asyncRoute, guard, managerGuard, type Authed } from "./portal";
import { isValidDate, isValidTime, lisbonToUtc } from "./portal-time";

const router: IRouter = Router();
router.use("/portal", cookieParser());

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (res: import("express").Response, status: number, error: string) => { res.status(status).json({ error }); };

// ── Rooms ───────────────────────────────────────────────────────────────────
router.get("/portal/rooms", guard, asyncRoute(async (_req, res) => {
  const rows = await db.select({ r: portalRoomsTable, photoAt: portalRoomPhotosTable.updatedAt }).from(portalRoomsTable)
    .leftJoin(portalRoomPhotosTable, eq(portalRoomPhotosTable.roomId, portalRoomsTable.id)).orderBy(asc(portalRoomsTable.sortOrder), asc(portalRoomsTable.name));
  res.json(rows.map(({ r, photoAt }) => ({ id: r.id, name: r.name, seats: r.seats, color: r.color, photoVersion: photoAt ? +photoAt : null })));
}));

router.get("/portal/rooms/:id/photo", guard, asyncRoute(async (req, res) => {
  const id = String(req.params.id);
  const [p] = UUID.test(id) ? await db.select().from(portalRoomPhotosTable).where(eq(portalRoomPhotosTable.roomId, id)) : [];
  if (!p) { bad(res, 404, "No photo."); return; }
  res.setHeader("Content-Type", p.contentType);
  res.setHeader("Cache-Control", "private, max-age=86400"); // the page asks with ?v=<version>, so a new photo gets a new URL
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(p.data);
}));

router.patch("/portal/admin/rooms/:id", managerGuard, asyncRoute(async (req, res) => {
  const name = String(req.body?.name ?? "").trim().slice(0, 60);
  const seats = Number(req.body?.seats);
  if (!name) { bad(res, 400, "A room needs a name."); return; }
  if (!Number.isInteger(seats) || seats < 1 || seats > 50) { bad(res, 400, "Seats must be a number from 1 to 50."); return; }
  const rows = await db.update(portalRoomsTable).set({ name, seats }).where(eq(portalRoomsTable.id, String(req.params.id))).returning({ id: portalRoomsTable.id });
  if (!rows.length) { bad(res, 404, "Room not found."); return; }
  res.json({ ok: true });
}));

const imageType = (b: Buffer) =>
  b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? "image/jpeg"
  : b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? "image/png"
  : b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" ? "image/webp" : null;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });
const uploadImage: RequestHandler = (req, res, next) => {
  upload.single("file")(req, res, (err?: unknown) => (err ? bad(res, 400, (err as { code?: string }).code === "LIMIT_FILE_SIZE" ? "The photo is over 2 MB." : "Upload failed.") : next()));
};

router.put("/portal/admin/rooms/:id/photo", managerGuard, uploadImage, asyncRoute(async (req, res) => {
  const id = String(req.params.id);
  const type = req.file ? imageType(req.file.buffer) : null;
  if (!req.file || !type) { bad(res, 400, "Upload a JPEG, PNG or WebP photo (up to 2 MB)."); return; }
  const [room] = UUID.test(id) ? await db.select({ id: portalRoomsTable.id }).from(portalRoomsTable).where(eq(portalRoomsTable.id, id)) : [];
  if (!room) { bad(res, 404, "Room not found."); return; }
  await db.insert(portalRoomPhotosTable).values({ roomId: id, contentType: type, data: req.file.buffer })
    .onConflictDoUpdate({ target: portalRoomPhotosTable.roomId, set: { contentType: type, data: req.file.buffer, updatedAt: new Date() } });
  res.json({ ok: true });
}));

router.delete("/portal/admin/rooms/:id/photo", managerGuard, asyncRoute(async (req, res) => {
  const id = String(req.params.id);
  if (UUID.test(id)) await db.delete(portalRoomPhotosTable).where(eq(portalRoomPhotosTable.roomId, id));
  res.json({ ok: true });
}));

// ── Cleaning / maintenance slots ────────────────────────────────────────────
router.get("/portal/blocks", guard, asyncRoute(async (req, res) => {
  const from = new Date(String(req.query.from ?? "")), to = new Date(String(req.query.to ?? ""));
  if (isNaN(+from) || isNaN(+to)) { bad(res, 400, "from/to required"); return; }
  const rows = await db.select().from(portalBlocksTable).where(and(lt(portalBlocksTable.startsAt, to), gt(portalBlocksTable.endsAt, from)));
  res.json(rows.map((b) => ({ id: b.id, roomId: b.roomId, kind: b.kind, title: b.title, startsAt: b.startsAt.toISOString(), endsAt: b.endsAt.toISOString() })));
}));

// ── Time parsing shared by bookings and blocks ──────────────────────────────
function parseSlot(b: Record<string, unknown>): { ok: true; startsAt: Date; endsAt: Date } | { ok: false; error: string } {
  if (!isValidDate(b.date) || !isValidTime(b.start) || !isValidTime(b.end)) return { ok: false, error: "Pick a date, start and end." };
  const startsAt = lisbonToUtc(b.date, b.start), endsAt = lisbonToUtc(b.date, b.end);
  if (isNaN(+startsAt) || isNaN(+endsAt) || endsAt <= startsAt) return { ok: false, error: "End must be after start." };
  if (endsAt > lisbonToUtc(b.date, "24:00")) return { ok: false, error: "A booking has to end by midnight of the same day." };
  return { ok: true, startsAt, endsAt };
}

router.post("/portal/admin/blocks", managerGuard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const b = req.body ?? {};
  const slot = parseSlot(b);
  if (!slot.ok) { bad(res, 400, slot.error); return; }
  if (!["cleaning", "maintenance"].includes(b.kind)) { bad(res, 400, "Choose cleaning or maintenance."); return; }
  const roomId = b.roomId && b.roomId !== "all" ? String(b.roomId) : null;
  if (roomId && !UUID.test(roomId)) { bad(res, 400, "Unknown room."); return; }
  const clash = await db.select({ id: portalBookingsTable.id }).from(portalBookingsTable)
    .where(and(lt(portalBookingsTable.startsAt, slot.endsAt), gt(portalBookingsTable.endsAt, slot.startsAt), roomId ? eq(portalBookingsTable.roomId, roomId) : undefined)).limit(1);
  if (clash.length) { bad(res, 409, "There is already a booking in that slot. Cancel or move it first."); return; }
  const [row] = await db.insert(portalBlocksTable).values({ roomId, kind: b.kind, title: String(b.title ?? "").trim().slice(0, 100), startsAt: slot.startsAt, endsAt: slot.endsAt, createdBy: me.id }).returning({ id: portalBlocksTable.id });
  res.status(201).json(row);
}));

router.delete("/portal/admin/blocks/:id", managerGuard, asyncRoute(async (req, res) => {
  const id = String(req.params.id);
  if (UUID.test(id)) await db.delete(portalBlocksTable).where(eq(portalBlocksTable.id, id));
  res.json({ ok: true });
}));

// ── Bookings ────────────────────────────────────────────────────────────────
// Bookings are in the booker's own name; anyone can book for someone else and say who it's for.
// Others see only that a slot is reserved. Admins see and can change everything.
type Row = { b: typeof portalBookingsTable.$inferSelect; owner: string };
const shape = (r: Row, me: Authed["client"]) => {
  const mine = r.b.clientId === me.id, full = mine || me.role === "admin";
  return {
    id: r.b.id, roomId: r.b.roomId, startsAt: r.b.startsAt.toISOString(), endsAt: r.b.endsAt.toISOString(), mine, canEdit: full,
    ...(full ? { title: r.b.title, bookedFor: r.b.bookedFor, notes: r.b.notes, owner: r.owner } : {}),
  };
};
const withOwner = () => db.select({ b: portalBookingsTable, owner: portalClientsTable.name }).from(portalBookingsTable).innerJoin(portalClientsTable, eq(portalClientsTable.id, portalBookingsTable.clientId));

router.get("/portal/bookings", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const from = new Date(String(req.query.from ?? "")), to = new Date(String(req.query.to ?? ""));
  if (isNaN(+from) || isNaN(+to)) { bad(res, 400, "from/to required"); return; }
  const rows = await withOwner().where(and(lt(portalBookingsTable.startsAt, to), gt(portalBookingsTable.endsAt, from))).orderBy(asc(portalBookingsTable.startsAt));
  res.json(rows.map((r) => shape(r, me)));
}));

router.get("/portal/my-bookings", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const now = new Date();
  const since = new Date(now); since.setMonth(now.getMonth() - 6);
  const rows = (await withOwner().where(and(eq(portalBookingsTable.clientId, me.id), gte(portalBookingsTable.endsAt, since))).orderBy(asc(portalBookingsTable.startsAt))).map((r) => shape(r, me));
  res.json({ upcoming: rows.filter((b) => new Date(b.endsAt) > now), past: rows.filter((b) => new Date(b.endsAt) <= now).reverse() });
}));

type Saved = { error: string; status: number } | { id: string };
async function saveBooking(opts: { me: Authed["client"]; id?: string; body: Record<string, unknown> }): Promise<Saved> {
  const { me, id, body: b } = opts;
  const title = String(b.title ?? "").trim().slice(0, 140);
  if (!UUID.test(String(b.roomId)) || !title) return { error: "A title and a room are required.", status: 400 };
  const slot = parseSlot(b);
  if (!slot.ok) return { error: slot.error, status: 400 };
  const { startsAt, endsAt } = slot;
  // New bookings must start in the future; an existing one can be edited while it's still running.
  if (id ? endsAt <= new Date() : startsAt < new Date()) return { error: "That time has already passed.", status: 400 };
  const roomId = String(b.roomId);
  const bookedFor = String(b.bookedFor ?? "").trim().slice(0, 120) || null;
  const notes = String(b.notes ?? "").trim().slice(0, 1000);

  return db.transaction(async (tx) => {
    const [room] = await tx.select({ id: portalRoomsTable.id }).from(portalRoomsTable).where(eq(portalRoomsTable.id, roomId));
    if (!room) return { error: "Room not found.", status: 404 };
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"room:" + roomId}))`);
    if (id) {
      const [cur] = await tx.select().from(portalBookingsTable).where(eq(portalBookingsTable.id, id));
      if (!cur) return { error: "Booking not found.", status: 404 };
      if (cur.clientId !== me.id && me.role !== "admin") return { error: "You can only change your own bookings.", status: 403 };
      if (cur.endsAt <= new Date()) return { error: "That booking is already over.", status: 400 };
    }
    const [clash] = await tx.select({ id: portalBookingsTable.id }).from(portalBookingsTable)
      .where(and(eq(portalBookingsTable.roomId, roomId), lt(portalBookingsTable.startsAt, endsAt), gt(portalBookingsTable.endsAt, startsAt), id ? ne(portalBookingsTable.id, id) : undefined)).limit(1);
    if (clash) return { error: "That slot is already taken. Pick another time.", status: 409 };
    const [block] = await tx.select({ kind: portalBlocksTable.kind }).from(portalBlocksTable)
      .where(and(or(eq(portalBlocksTable.roomId, roomId), isNull(portalBlocksTable.roomId)), lt(portalBlocksTable.startsAt, endsAt), gt(portalBlocksTable.endsAt, startsAt))).limit(1);
    if (block) return { error: `The room is blocked for ${block.kind} at that time.`, status: 409 };
    if (id) {
      await tx.update(portalBookingsTable).set({ roomId, title, bookedFor, notes, startsAt, endsAt, updatedAt: new Date() }).where(eq(portalBookingsTable.id, id));
      return { id };
    }
    const [row] = await tx.insert(portalBookingsTable).values({ roomId, clientId: me.id, title, bookedFor, notes, startsAt, endsAt }).returning({ id: portalBookingsTable.id });
    return { id: row!.id };
  });
}

router.post("/portal/bookings", guard, asyncRoute(async (req, res) => {
  const out = await saveBooking({ me: (req as Authed).client, body: req.body ?? {} });
  if ("error" in out) { bad(res, out.status, out.error); return; }
  res.status(201).json(out);
}));

router.put("/portal/bookings/:id", guard, asyncRoute(async (req, res) => {
  const id = String(req.params.id);
  if (!UUID.test(id)) { bad(res, 404, "Booking not found."); return; }
  const out = await saveBooking({ me: (req as Authed).client, id, body: req.body ?? {} });
  if ("error" in out) { bad(res, out.status, out.error); return; }
  res.json(out);
}));

// Cancel: your own booking until it ends, or any booking if you're an admin. The room is freed immediately.
router.delete("/portal/bookings/:id", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const id = String(req.params.id);
  if (!UUID.test(id)) { bad(res, 404, "Booking not found."); return; }
  const rows = await db.delete(portalBookingsTable)
    .where(and(eq(portalBookingsTable.id, id), me.role === "admin" ? undefined : and(eq(portalBookingsTable.clientId, me.id), gt(portalBookingsTable.endsAt, new Date()))))
    .returning({ id: portalBookingsTable.id });
  if (!rows.length) { bad(res, 404, "Booking not found, or it's already over."); return; }
  res.json({ ok: true });
}));

export default router;
