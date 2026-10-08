import { Router, type IRouter } from "express";
import cookieParser from "cookie-parser";
import { db, portalSuppliersTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { asyncRoute, managerGuard } from "./portal";

const router: IRouter = Router();
router.use("/portal", cookieParser());

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (res: import("express").Response, status: number, error: string) => { res.status(status).json({ error }); };
const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

function fields(b: Record<string, unknown>) {
  const name = text(b.name, 120), email = text(b.email, 200);
  if (!name) return { ok: false as const, error: "A supplier needs a name." };
  if (email && !/^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/.test(email)) return { ok: false as const, error: "That doesn't look like a valid email address." };
  return { ok: true as const, value: { name, what: text(b.what, 300), contactName: text(b.contactName, 120), phone: text(b.phone, 60), email, notes: text(b.notes, 1000) } };
}

router.get("/portal/admin/suppliers", managerGuard, asyncRoute(async (_req, res) => {
  res.json(await db.select().from(portalSuppliersTable).orderBy(asc(portalSuppliersTable.name)));
}));

router.post("/portal/admin/suppliers", managerGuard, asyncRoute(async (req, res) => {
  const f = fields(req.body ?? {});
  if (!f.ok) { bad(res, 400, f.error); return; }
  const [row] = await db.insert(portalSuppliersTable).values(f.value).returning();
  res.status(201).json(row);
}));

router.patch("/portal/admin/suppliers/:id", managerGuard, asyncRoute(async (req, res) => {
  const id = String(req.params.id);
  const [cur] = UUID.test(id) ? await db.select().from(portalSuppliersTable).where(eq(portalSuppliersTable.id, id)) : [];
  if (!cur) { bad(res, 404, "Supplier not found."); return; }
  // Only the fields that were sent change; the rest keep their value.
  const b = req.body ?? {};
  const f = fields({ name: cur.name, what: cur.what, contactName: cur.contactName, phone: cur.phone, email: cur.email, notes: cur.notes, ...b });
  if (!f.ok) { bad(res, 400, f.error); return; }
  const [row] = await db.update(portalSuppliersTable).set(f.value).where(eq(portalSuppliersTable.id, id)).returning();
  res.json(row);
}));

// Items that pointed at this supplier simply lose the link (the database sets it to empty).
router.delete("/portal/admin/suppliers/:id", managerGuard, asyncRoute(async (req, res) => {
  const id = String(req.params.id);
  if (UUID.test(id)) await db.delete(portalSuppliersTable).where(eq(portalSuppliersTable.id, id));
  res.json({ ok: true });
}));

export default router;
