import { Router, type IRouter } from "express";
import { db, inventoryRequestsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/inventory", async (_req, res) => {
  const items = await db.select().from(inventoryRequestsTable).orderBy(inventoryRequestsTable.createdAt);
  res.json(items);
});

router.post("/inventory", async (req, res) => {
  const { itemName, category, urgency, requestedBy } = req.body;
  const [item] = await db.insert(inventoryRequestsTable).values({
    itemName, category, urgency, requestedBy, status: "Pending",
  }).returning();
  res.status(201).json(item);
});

router.put("/inventory/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body;
  const updates: Partial<typeof inventoryRequestsTable.$inferInsert> = {};
  if (status !== undefined) updates.status = status;

  const [item] = await db.update(inventoryRequestsTable).set(updates).where(eq(inventoryRequestsTable.id, id)).returning();
  if (!item) { res.status(404).json({ error: "Not found", message: "Request not found" }); return; }
  res.json(item);
});

router.delete("/inventory/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(inventoryRequestsTable).where(eq(inventoryRequestsTable.id, id));
  res.status(204).send();
});

router.post("/inventory/:id/upvote", async (req, res) => {
  const id = parseInt(req.params.id);
  const [item] = await db.update(inventoryRequestsTable)
    .set({ upvotes: sql`${inventoryRequestsTable.upvotes} + 1` })
    .where(eq(inventoryRequestsTable.id, id))
    .returning();
  if (!item) { res.status(404).json({ error: "Not found", message: "Request not found" }); return; }
  res.json(item);
});

export default router;
