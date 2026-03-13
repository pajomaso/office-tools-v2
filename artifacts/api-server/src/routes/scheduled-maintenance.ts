import { Router, type IRouter } from "express";
import { db, scheduledMaintenanceTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/scheduled-maintenance", async (_req, res) => {
  const tasks = await db.select().from(scheduledMaintenanceTable).orderBy(scheduledMaintenanceTable.nextDue);
  res.json(tasks);
});

router.post("/scheduled-maintenance", async (req, res) => {
  const { taskName, description, frequencyDays, lastDone, nextDue } = req.body;
  const [task] = await db.insert(scheduledMaintenanceTable).values({
    taskName, description: description ?? null, frequencyDays, lastDone: lastDone ?? null, nextDue,
  }).returning();
  res.status(201).json(task);
});

router.put("/scheduled-maintenance/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { taskName, description, frequencyDays, lastDone, nextDue } = req.body;
  const updates: Partial<typeof scheduledMaintenanceTable.$inferInsert> = {};
  if (taskName !== undefined) updates.taskName = taskName;
  if (description !== undefined) updates.description = description;
  if (frequencyDays !== undefined) updates.frequencyDays = frequencyDays;
  if (lastDone !== undefined) updates.lastDone = lastDone;
  if (nextDue !== undefined) updates.nextDue = nextDue;

  const [task] = await db.update(scheduledMaintenanceTable).set(updates).where(eq(scheduledMaintenanceTable.id, id)).returning();
  if (!task) { res.status(404).json({ error: "Not found", message: "Task not found" }); return; }
  res.json(task);
});

router.delete("/scheduled-maintenance/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(scheduledMaintenanceTable).where(eq(scheduledMaintenanceTable.id, id));
  res.status(204).send();
});

export default router;
