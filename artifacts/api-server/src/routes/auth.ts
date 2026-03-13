import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.post("/auth/admin-login", async (req, res) => {
  const { password } = req.body;
  if (!password) {
    res.status(400).json({ error: "Password required" });
    return;
  }
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, "admin_password"));
  const correct = row?.value ?? "Room42";
  if (password === correct) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Incorrect password" });
  }
});

router.get("/settings/admin-password", async (_req, res) => {
  res.json({ hint: "Password is set — use the change form to update it." });
});

router.put("/settings/admin-password", async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Both currentPassword and newPassword are required" });
    return;
  }
  if (newPassword.trim().length < 4) {
    res.status(400).json({ error: "New password must be at least 4 characters" });
    return;
  }
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, "admin_password"));
  const current = row?.value ?? "Room42";
  if (currentPassword !== current) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }
  await db
    .insert(settingsTable)
    .values({ key: "admin_password", value: newPassword.trim() })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: newPassword.trim(), updatedAt: new Date() } });
  res.json({ success: true });
});

export default router;
