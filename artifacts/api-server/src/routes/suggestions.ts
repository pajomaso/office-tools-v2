import { Router, type IRouter } from "express";
import { db, suggestionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/suggestions", async (_req, res) => {
  const suggestions = await db.select().from(suggestionsTable).orderBy(suggestionsTable.createdAt);
  res.json(suggestions);
});

router.post("/suggestions", async (req, res) => {
  const { title, body, category, submittedBy } = req.body;
  const now = new Date();
  const [suggestion] = await db.insert(suggestionsTable).values({
    title, body, category: category ?? "General", submittedBy,
    status: "Open", updatedAt: now,
  }).returning();
  res.status(201).json(suggestion);
});

router.put("/suggestions/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { status, adminReply } = req.body;
  const updates: Partial<typeof suggestionsTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (status !== undefined) updates.status = status;
  if (adminReply !== undefined) updates.adminReply = adminReply;

  const [suggestion] = await db.update(suggestionsTable).set(updates).where(eq(suggestionsTable.id, id)).returning();
  if (!suggestion) { res.status(404).json({ error: "Not found", message: "Suggestion not found" }); return; }
  res.json(suggestion);
});

router.delete("/suggestions/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(suggestionsTable).where(eq(suggestionsTable.id, id));
  res.status(204).send();
});

export default router;
