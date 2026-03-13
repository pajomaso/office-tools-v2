import { Router, type IRouter } from "express";
import { db, vendorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/vendors", async (_req, res) => {
  const vendors = await db.select().from(vendorsTable).orderBy(vendorsTable.name);
  res.json(vendors);
});

router.post("/vendors", async (req, res) => {
  const { name, specialty, phone, email, notes } = req.body;
  const [vendor] = await db.insert(vendorsTable).values({
    name, specialty, phone, email: email ?? null, notes: notes ?? null,
  }).returning();
  res.status(201).json(vendor);
});

router.put("/vendors/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, specialty, phone, email, notes } = req.body;
  const updates: Partial<typeof vendorsTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (specialty !== undefined) updates.specialty = specialty;
  if (phone !== undefined) updates.phone = phone;
  if (email !== undefined) updates.email = email;
  if (notes !== undefined) updates.notes = notes;

  const [vendor] = await db.update(vendorsTable).set(updates).where(eq(vendorsTable.id, id)).returning();
  if (!vendor) { res.status(404).json({ error: "Not found", message: "Vendor not found" }); return; }
  res.json(vendor);
});

router.delete("/vendors/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(vendorsTable).where(eq(vendorsTable.id, id));
  res.status(204).send();
});

export default router;
