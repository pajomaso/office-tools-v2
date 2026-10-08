import { Router, type IRouter, type Request, type Response } from "express";
import { db, portalTagBatchesTable, portalTagChangesTable, portalTagsTable } from "@workspace/db";
import { and, asc, eq, gt, inArray, ne } from "drizzle-orm";
import { applyChange, hashToken, UUID } from "./portal-tags";

// The supplier's page. No account: the secret link IS the credential. It only ever shows one batch and
// can only mark that batch's lines as done. Everything is rate-limited and sent with privacy headers.
const router: IRouter = Router();

const hits = new Map<string, { all: number[]; bad: number[] }>();
function limited(req: Request, kind: "all" | "bad", max: number, windowMs: number): boolean {
  const ip = req.ip ?? "unknown";
  const e = hits.get(ip) ?? { all: [], bad: [] };
  e[kind] = e[kind].filter((t) => Date.now() - t < windowMs);
  hits.set(ip, e);
  return e[kind].length >= max;
}
const note = (req: Request, kind: "all" | "bad") => { const e = hits.get(req.ip ?? "unknown")!; e[kind].push(Date.now()); };

function privacy(res: Response) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Referrer-Policy", "no-referrer");
}
const INVALID = "This link is invalid or has expired. Ask the office for a new one.";

async function batchFor(req: Request, res: Response) {
  privacy(res);
  if (limited(req, "all", 120, 10 * 60_000) || limited(req, "bad", 20, 60 * 60_000)) { res.status(429).json({ error: "Too many requests. Please try again later." }); return null; }
  note(req, "all");
  const token = String(req.params.token ?? "");
  const [b] = token.length >= 40 && token.length <= 64
    ? await db.select().from(portalTagBatchesTable).where(and(eq(portalTagBatchesTable.linkHash, hashToken(token)), inArray(portalTagBatchesTable.status, ["sent", "done"]), gt(portalTagBatchesTable.linkExpiresAt, new Date())))
    : [];
  if (!b || b.revokedAt) { note(req, "bad"); res.status(404).json({ error: INVALID }); return null; } // same answer whether it never existed, expired or was revoked
  return b;
}

async function linesOf(batchId: string) {
  const rows = await db.select({ c: portalTagChangesTable, number: portalTagsTable.number, level: portalTagsTable.accessLevel }).from(portalTagChangesTable)
    .innerJoin(portalTagsTable, eq(portalTagsTable.id, portalTagChangesTable.tagId))
    .where(and(eq(portalTagChangesTable.batchId, batchId), ne(portalTagChangesTable.status, "removed"))).orderBy(asc(portalTagChangesTable.createdAt));
  // Only what he needs to make the change in his own system: no codes, no emails, no internal notes.
  return rows.map(({ c, number, level }) => ({ id: c.id, tagNumber: number, kind: c.kind, fromName: c.fromName, toName: c.toName, level, status: c.status, doneAt: c.doneAt }));
}

const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: (e?: unknown) => void) => { fn(req, res).catch(next); };

router.get("/portal/access/:token", wrap(async (req, res) => {
  const b = await batchFor(req, res); if (!b) return;
  res.json({ sentAt: b.sentAt, expiresAt: b.linkExpiresAt, lines: await linesOf(b.id) });
}));

router.post("/portal/access/:token/lines/:id/done", wrap(async (req, res) => {
  const b = await batchFor(req, res); if (!b) return;
  const id = String(req.params.id);
  const [line] = UUID.test(id) ? await db.select({ id: portalTagChangesTable.id }).from(portalTagChangesTable).where(and(eq(portalTagChangesTable.id, id), eq(portalTagChangesTable.batchId, b.id))) : [];
  if (!line) { res.status(404).json({ error: "That line isn't part of this request." }); return; }
  const result = await db.transaction((tx) => applyChange(tx, id, { actor: "Ricardo", bySupplier: true, ip: req.ip }));
  res.json({ result, lines: await linesOf(b.id) });
}));

router.post("/portal/access/:token/done-all", wrap(async (req, res) => {
  const b = await batchFor(req, res); if (!b) return;
  const pending = await db.select({ id: portalTagChangesTable.id }).from(portalTagChangesTable).where(and(eq(portalTagChangesTable.batchId, b.id), eq(portalTagChangesTable.status, "pending"))).orderBy(asc(portalTagChangesTable.createdAt));
  const counts = { done: 0, outdated: 0 };
  for (const p of pending) { const r = await db.transaction((tx) => applyChange(tx, p.id, { actor: "Ricardo", bySupplier: true, ip: req.ip })); if (r === "done") counts.done++; if (r === "outdated") counts.outdated++; }
  res.json({ ...counts, lines: await linesOf(b.id) });
}));

export default router;
