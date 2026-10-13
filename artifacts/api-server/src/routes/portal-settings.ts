import { Router, type IRouter, type RequestHandler } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { db, portalGuidePhotosTable, portalSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { asyncRoute, guard, managerGuard } from "./portal";
import { imageType } from "./portal-rooms";
import { DEFAULT_BOOKING_NOTE, DEFAULT_GUIDES } from "./portal-area";
import { DEFAULT_WELCOME } from "./portal-mail";
import { occupancyWindow } from "./portal-metrics";
import { validWindow } from "./portal-metrics-calc";

// Everything an admin can edit without a developer: the texts people read, the WiFi details, and the working window used by the metrics.
// (Room names, seats and photos are edited from the Rooms page; the supplier's email from the Tags page.)
const router: IRouter = Router();
router.use("/portal", cookieParser());

const bad = (res: import("express").Response, status: number, error: string) => { res.status(status).json({ error }); };
const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

async function get<T>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(portalSettingsTable).where(eq(portalSettingsTable.key, key));
  return (row?.value as T) ?? fallback;
}
const put = (key: string, value: unknown) => db.insert(portalSettingsTable).values({ key, value }).onConflictDoUpdate({ target: portalSettingsTable.key, set: { value } });

type Wifi = { label: string; visibility: "everyone" | "subvisual"; ssid: string; password: string; note: string };

router.get("/portal/admin/settings", managerGuard, asyncRoute(async (_req, res) => {
  const w = await get<Partial<{ subject: string; body: string }>>("welcome_email", {});
  res.json({
    bookingNote: await get("booking_note", DEFAULT_BOOKING_NOTE),
    guides: await get("guides", DEFAULT_GUIDES),
    wifi: await get<Wifi[]>("wifi", []),
    occupancyWindow: await occupancyWindow(),
    welcomeEmail: { subject: w.subject || DEFAULT_WELCOME.subject, body: w.body || DEFAULT_WELCOME.body },
  });
}));

router.put("/portal/admin/settings/booking-note", managerGuard, asyncRoute(async (req, res) => {
  const note = text(req.body?.text, 500);
  if (!note) { bad(res, 400, "The note can't be empty."); return; }
  await put("booking_note", note);
  res.json({ ok: true });
}));

router.put("/portal/admin/settings/guides", managerGuard, asyncRoute(async (req, res) => {
  const list = Array.isArray(req.body?.guides) ? req.body.guides : null;
  if (!list || list.length > 20) { bad(res, 400, "Send up to 20 guides."); return; }
  const guides = [];
  for (const g of list) {
    const title = text(g?.title, 100), body = String(g?.body ?? "").slice(0, 4000);
    if (!title) { bad(res, 400, "Every guide needs a title."); return; }
    guides.push({ id: text(g?.id, 60) || randomUUID(), title, body });
  }
  await put("guides", guides);
  res.json({ guides });
}));

// Guide photos: an admin uploads one and gets back its link, which the Settings page adds to the guide's text.
// Photos are never deleted automatically (removing the line just hides it), so nothing is lost by mistake.
const GUIDE_PHOTO_MAX = 5 * 1024 * 1024;
const guideUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: GUIDE_PHOTO_MAX, files: 1 } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const uploadGuidePhoto: RequestHandler = (req, res, next) =>
  guideUpload.single("file")(req, res, (err?: unknown) => (err ? bad(res, 400, (err as { code?: string }).code === "LIMIT_FILE_SIZE" ? "The photo is over 5 MB." : "Upload failed.") : next()));

router.post("/portal/admin/guide-photos", managerGuard, uploadGuidePhoto,
  asyncRoute(async (req, res) => {
    const type = req.file ? imageType(req.file.buffer) : null;
    if (!req.file || !type) { bad(res, 400, "Upload a JPEG, PNG or WebP photo (up to 5 MB)."); return; }
    const [row] = await db.insert(portalGuidePhotosTable).values({ contentType: type, data: req.file.buffer }).returning({ id: portalGuidePhotosTable.id });
    res.status(201).json({ url: `/api/portal/guide-photos/${row!.id}` });
  }));

// Anyone signed in can see them (guides are for everyone in the office).
router.get("/portal/guide-photos/:id", guard, asyncRoute(async (req, res) => {
  const id = String(req.params.id);
  const [p] = UUID.test(id) ? await db.select().from(portalGuidePhotosTable).where(eq(portalGuidePhotosTable.id, id)) : [];
  if (!p) { bad(res, 404, "No photo."); return; }
  res.setHeader("Content-Type", p.contentType);
  res.setHeader("Cache-Control", "private, max-age=604800, immutable"); // a photo never changes: a new upload gets a new link
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(p.data);
}));

router.put("/portal/admin/settings/wifi", managerGuard, asyncRoute(async (req, res) => {
  const list = Array.isArray(req.body?.networks) ? req.body.networks : null;
  if (!list || list.length > 10) { bad(res, 400, "Send up to 10 networks."); return; }
  const networks: Wifi[] = [];
  for (const n of list) {
    const ssid = text(n?.ssid, 64);
    if (!ssid) { bad(res, 400, "Every network needs a name (SSID)."); return; }
    networks.push({ label: text(n?.label, 60) || "WiFi", visibility: n?.visibility === "subvisual" ? "subvisual" : "everyone", ssid, password: String(n?.password ?? "").slice(0, 128), note: text(n?.note, 200) });
  }
  await put("wifi", networks);
  res.json({ networks });
}));

router.put("/portal/admin/settings/occupancy-window", managerGuard, asyncRoute(async (req, res) => {
  const w = validWindow(req.body);
  if (!w) { bad(res, 400, "Choose a start hour before the end hour, and at least one weekday."); return; }
  await put("occupancy_window", w);
  res.json(w);
}));

export default router;
