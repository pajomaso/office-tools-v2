import { Router, type IRouter } from "express";
import { db, roomsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/rooms", async (_req, res) => {
  const rooms = await db.select().from(roomsTable).orderBy(roomsTable.id);
  res.json(rooms.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    photoUrl: r.photoUrl,
    capacity: r.capacity,
    createdAt: r.createdAt,
  })));
});

router.post("/rooms", async (req, res) => {
  const { name, description, photoUrl, capacity } = req.body;
  const [room] = await db.insert(roomsTable).values({
    name,
    description: description ?? "",
    photoUrl: photoUrl ?? null,
    capacity: capacity ?? 10,
  }).returning();
  res.status(201).json({
    id: room.id,
    name: room.name,
    description: room.description,
    photoUrl: room.photoUrl,
    capacity: room.capacity,
    createdAt: room.createdAt,
  });
});

router.put("/rooms/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description, photoUrl, capacity } = req.body;
  const updates: Partial<{ name: string; description: string; photoUrl: string | null; capacity: number }> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (photoUrl !== undefined) updates.photoUrl = photoUrl;
  if (capacity !== undefined) updates.capacity = capacity;

  const [room] = await db.update(roomsTable).set(updates).where(eq(roomsTable.id, id)).returning();
  if (!room) { res.status(404).json({ error: "Not found", message: "Room not found" }); return; }
  res.json({
    id: room.id,
    name: room.name,
    description: room.description,
    photoUrl: room.photoUrl,
    capacity: room.capacity,
    createdAt: room.createdAt,
  });
});

export default router;
