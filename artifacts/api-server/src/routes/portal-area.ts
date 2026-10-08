import { Router, type IRouter } from "express";
import cookieParser from "cookie-parser";
import { db, portalSettingsTable, portalTagsTable, portalTagChangesTable, portalItemsTable } from "@workspace/db";
import { and, asc, eq, inArray } from "drizzle-orm";
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

// What the person sees about their own tag. The number and code stay out of this payload; they're fetched on request below.
async function myTag(userId: string) {
  const [own] = await db.select().from(portalTagsTable).where(and(eq(portalTagsTable.clientId, userId), inArray(portalTagsTable.status, ["active", "blocked"]))).limit(1);
  const [waiting] = await db.select({ c: portalTagChangesTable, t: portalTagsTable }).from(portalTagChangesTable).innerJoin(portalTagsTable, eq(portalTagsTable.id, portalTagChangesTable.tagId))
    .where(and(eq(portalTagChangesTable.status, "pending"), eq(portalTagChangesTable.toUserId, userId), inArray(portalTagChangesTable.kind, ["assign", "reassign"]))).orderBy(asc(portalTagChangesTable.createdAt)).limit(1);
  const [leaving] = own ? await db.select({ c: portalTagChangesTable }).from(portalTagChangesTable).where(and(eq(portalTagChangesTable.tagId, own.id), eq(portalTagChangesTable.status, "pending"))).limit(1) : [];
  return { own, waiting, leaving };
}

router.get("/portal/my-tag", guard, asyncRoute(async (req, res) => {
  const { own, waiting, leaving } = await myTag((req as Authed).client.id);
  res.json({
    tag: own ? { status: own.status, level: own.accessLevel, hasCode: !!own.codeEnc } : null,
    pending: waiting ? { kind: waiting.c.kind, hasCode: !!waiting.t.codeEnc } : leaving ? { kind: leaving.c.kind, hasCode: false } : null,
  });
}));

// The number and code are only sent when the person asks to see them, and only for their own tag
// (the one they hold, or the one they're waiting for).
router.get("/portal/my-tag/code", guard, asyncRoute(async (req, res) => {
  const { own, waiting } = await myTag((req as Authed).client.id);
  const tag = own ?? waiting?.t;
  res.setHeader("Cache-Control", "no-store");
  res.json({ number: tag?.number ?? null, code: tag?.codeEnc ? decryptCode(tag.codeEnc) : null, active: tag?.status === "active" && !waiting });
}));

// Asking for a tag, a replacement, or a new code reaches the admins as a private request. They decide, and any change
// that touches the supplier's records goes into the pending batch from the Tags page.
const REQUESTS = {
  new: (n: string) => ({ title: `Tag request from ${n}`, body: "Asked for an access tag from the personal area." }),
  lost: (n: string) => ({ title: `Lost tag: ${n}`, body: "Says their tag is lost and needs a replacement." }),
  code: (n: string) => ({ title: `New door code for ${n}`, body: "Asked for a new door code from the personal area." }),
} as const;

router.post("/portal/me/request", guard, asyncRoute(async (req, res) => {
  const me = (req as Authed).client;
  const kind = String(req.body?.kind) as keyof typeof REQUESTS;
  if (!(kind in REQUESTS)) { res.status(400).json({ error: "Unknown request." }); return; }
  const { title, body } = REQUESTS[kind](me.name);
  const [dupe] = await db.select({ id: portalItemsTable.id }).from(portalItemsTable)
    .where(and(eq(portalItemsTable.authorId, me.id), eq(portalItemsTable.title, title), inArray(portalItemsTable.status, ["open", "claimed"]))).limit(1);
  if (dupe) { res.status(409).json({ error: "You already asked. An admin will handle it." }); return; }
  await db.insert(portalItemsTable).values({ authorId: me.id, kind: "request", visibility: "private", title, body });
  res.status(201).json({ ok: true });
}));

export default router;
