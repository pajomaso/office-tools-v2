import { Router, type IRouter } from "express";
import { db, maintenanceTicketsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/maintenance", async (_req, res) => {
  const tickets = await db.select().from(maintenanceTicketsTable).orderBy(maintenanceTicketsTable.createdAt);
  res.json(tickets);
});

router.post("/maintenance", async (req, res) => {
  const { title, description, category, photoUrl, reportedBy } = req.body;
  const now = new Date();
  const [ticket] = await db.insert(maintenanceTicketsTable).values({
    title, description, category, photoUrl: photoUrl ?? null, reportedBy, status: "Reported",
    updatedAt: now,
  }).returning();
  res.status(201).json(ticket);
});

router.put("/maintenance/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { status, title, description } = req.body;
  const updates: Partial<typeof maintenanceTicketsTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (status !== undefined) updates.status = status;
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;

  const [ticket] = await db.update(maintenanceTicketsTable).set(updates).where(eq(maintenanceTicketsTable.id, id)).returning();
  if (!ticket) { res.status(404).json({ error: "Not found", message: "Ticket not found" }); return; }
  res.json(ticket);
});

export default router;
