import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

async function getSetting(key: string, fallback = "") {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  return row?.value ?? fallback;
}

async function setSetting(key: string, value: string) {
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
}

// ── Admin login ────────────────────────────────────────────────────────────
router.post("/auth/admin-login", async (req, res) => {
  const { password } = req.body;
  if (!password) { res.status(400).json({ error: "Password required" }); return; }
  const correct = await getSetting("admin_password", "Room42");
  if (password === correct) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Incorrect password" });
  }
});

// ── Admin password ─────────────────────────────────────────────────────────
router.get("/settings/admin-password", async (_req, res) => {
  res.json({ hint: "Password is set — use the change form to update it." });
});

router.put("/settings/admin-password", async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Both currentPassword and newPassword are required" }); return;
  }
  if (newPassword.trim().length < 4) {
    res.status(400).json({ error: "New password must be at least 4 characters" }); return;
  }
  const current = await getSetting("admin_password", "Room42");
  if (currentPassword !== current) {
    res.status(401).json({ error: "Current password is incorrect" }); return;
  }
  await setSetting("admin_password", newPassword.trim());
  res.json({ success: true });
});

// ── Office info (editable instructions) ───────────────────────────────────
const DEFAULT_INSTRUCTIONS = `## Alarm & Access

Instructions to be added by admin.`;

const DEFAULT_CONTACTS = `Paulo Sousa - 916 632 542`;

router.get("/settings/office-info", async (_req, res) => {
  const [instructions, instructionsVideo, contacts] = await Promise.all([
    getSetting("info_instructions", DEFAULT_INSTRUCTIONS),
    getSetting("info_instructions_video", ""),
    getSetting("info_contacts", DEFAULT_CONTACTS),
  ]);
  res.json({ instructions, instructionsVideo, contacts });
});

router.put("/settings/office-info", async (req, res) => {
  const { instructions, instructionsVideo, contacts } = req.body;
  await Promise.all([
    instructions !== undefined ? setSetting("info_instructions", instructions) : Promise.resolve(),
    instructionsVideo !== undefined ? setSetting("info_instructions_video", instructionsVideo) : Promise.resolve(),
    contacts !== undefined ? setSetting("info_contacts", contacts) : Promise.resolve(),
  ]);
  res.json({ success: true });
});

export default router;
