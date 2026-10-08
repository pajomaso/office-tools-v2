import { Router, type IRouter } from "express";
import cookieParser from "cookie-parser";
import { db, portalSettingsTable, portalTagsTable, portalTagRequestsTable, portalItemsTable } from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { asyncRoute, guard, type Authed } from "./portal";
import { decryptCode } from "./portal-crypto";

const router: IRouter = Router();
router.use("/portal", cookieParser());

// Defaults for the copy admins can edit later (settings page). [Square brackets] mark what still needs filling in.
export const DEFAULT_BOOKING_NOTE = "Use it wisely. If you cancel, others can use the room.";
export const DEFAULT_GUIDES = [
  { id: "door", title: "How to open the door", body: "[Add the steps for opening the door.]" },
  { id: "app", title: "How to use this app", body: "[Add a short guide to booking rooms and sending requests.]" },
  { id: "signup", title: "How to sign up", body: "[Add how a new person gets an account.]" },
];
type Wifi = { label?: string; visibility?: string; ssid: string; password: string; note?: string };

async function setting<T>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(portalSettingsTable).where(eq(portalSettingsTable.key, key));
  return (row?.value as T) ?? fallback;
}

// Everyone sees the guest network; @subvisual.co accounts also see the internal one.
router.get("/portal/area", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const isSubvisual = me.email.toLowerCase().endsWith("@subvisual.co");
  const wifi = (await setting<Wifi[]>("wifi", [])).filter((w) => w.visibility !== "subvisual" || isSubvisual);
  res.json({
    wifi: wifi.map((w) => ({ label: w.label ?? "WiFi", internal: w.visibility === "subvisual", ssid: w.ssid, password: w.password, note: w.note ?? "" })),
    guides: await setting("guides", DEFAULT_GUIDES),
    bookingNote: await setting("booking_note", DEFAULT_BOOKING_NOTE),
  });
}));

// The code is only sent when the person asks to see it, and only for their own tag
// (their active tag, or the one they're waiting for).
router.get("/portal/my-tag/code", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  let [tag] = await db.select().from(portalTagsTable).where(and(eq(portalTagsTable.clientId, me.id), eq(portalTagsTable.status, "active"))).limit(1);
  if (!tag) {
    const [open] = await db.select().from(portalTagRequestsTable).where(and(eq(portalTagRequestsTable.clientId, me.id), inArray(portalTagRequestsTable.status, ["to_send", "sent"]))).orderBy(desc(portalTagRequestsTable.createdAt)).limit(1);
    if (open?.newTagNumber) [tag] = await db.select().from(portalTagsTable).where(eq(portalTagsTable.number, open.newTagNumber));
  }
  res.setHeader("Cache-Control", "no-store");
  res.json({ number: tag?.number ?? null, code: tag?.codeEnc ? decryptCode(tag.codeEnc) : null, active: tag?.status === "active" });
}));

// "I need a new code": admins change codes themselves, so this goes to them as a private request.
router.post("/portal/me/request-code", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const title = `New door code for ${me.name}`;
  const [dupe] = await db.select({ id: portalItemsTable.id }).from(portalItemsTable)
    .where(and(eq(portalItemsTable.authorId, me.id), eq(portalItemsTable.title, title), inArray(portalItemsTable.status, ["open", "claimed"]))).limit(1);
  if (dupe) { res.status(409).json({ error: "You already asked for a new code. An admin will handle it." }); return; }
  await db.insert(portalItemsTable).values({ authorId: me.id, kind: "request", visibility: "private", title, body: "Requested from the personal area." });
  res.status(201).json({ ok: true });
}));

export default router;
