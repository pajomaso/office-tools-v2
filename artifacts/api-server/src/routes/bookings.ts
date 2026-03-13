import { Router, type IRouter } from "express";
import { db, bookingsTable, roomsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

router.get("/bookings", async (req, res) => {
  const { date, roomId } = req.query;
  let bookings = await db.select({
    booking: bookingsTable,
    roomName: roomsTable.name,
  }).from(bookingsTable)
    .leftJoin(roomsTable, eq(bookingsTable.roomId, roomsTable.id));

  if (date) {
    bookings = bookings.filter(b => b.booking.date === date);
  }
  if (roomId) {
    bookings = bookings.filter(b => b.booking.roomId === parseInt(roomId as string));
  }

  res.json(bookings.map(b => ({
    id: b.booking.id,
    roomId: b.booking.roomId,
    roomName: b.roomName ?? "",
    userName: b.booking.userName,
    title: b.booking.title,
    date: b.booking.date,
    startTime: b.booking.startTime,
    endTime: b.booking.endTime,
    createdAt: b.booking.createdAt,
  })));
});

router.post("/bookings", async (req, res) => {
  const { roomId, userName, title, date, startTime, endTime } = req.body;

  // Check for conflicts
  const existing = await db.select().from(bookingsTable)
    .where(and(eq(bookingsTable.roomId, roomId), eq(bookingsTable.date, date)));

  const conflict = existing.find(b => timesOverlap(startTime, endTime, b.startTime, b.endTime));
  if (conflict) {
    res.status(409).json({ error: "Conflict", message: "This room is already booked for that time." });
    return;
  }

  const [booking] = await db.insert(bookingsTable).values({
    roomId, userName, title, date, startTime, endTime,
  }).returning();

  const room = await db.select().from(roomsTable).where(eq(roomsTable.id, roomId)).then(r => r[0]);

  res.status(201).json({
    id: booking.id,
    roomId: booking.roomId,
    roomName: room?.name ?? "",
    userName: booking.userName,
    title: booking.title,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    createdAt: booking.createdAt,
  });
});

router.put("/bookings/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { userName, title, date, startTime, endTime } = req.body;
  const updates: Partial<typeof bookingsTable.$inferInsert> = {};
  if (userName !== undefined) updates.userName = userName;
  if (title !== undefined) updates.title = title;
  if (date !== undefined) updates.date = date;
  if (startTime !== undefined) updates.startTime = startTime;
  if (endTime !== undefined) updates.endTime = endTime;

  const [booking] = await db.update(bookingsTable).set(updates).where(eq(bookingsTable.id, id)).returning();
  if (!booking) { res.status(404).json({ error: "Not found", message: "Booking not found" }); return; }

  const room = await db.select().from(roomsTable).where(eq(roomsTable.id, booking.roomId)).then(r => r[0]);

  res.json({
    id: booking.id,
    roomId: booking.roomId,
    roomName: room?.name ?? "",
    userName: booking.userName,
    title: booking.title,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    createdAt: booking.createdAt,
  });
});

router.delete("/bookings/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(bookingsTable).where(eq(bookingsTable.id, id));
  res.status(204).send();
});

export default router;
