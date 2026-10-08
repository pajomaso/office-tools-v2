import { Router, type IRouter } from "express";
import cookieParser from "cookie-parser";
import { db, portalBookingsTable, portalClientsTable, portalRoomsTable, portalSettingsTable } from "@workspace/db";
import { and, asc, desc, eq, gte, ilike, lt, or, sql } from "drizzle-orm";
import { asyncRoute, managerGuard } from "./portal";
import { isValidDate, lisbonToUtc, partsOf } from "./portal-time";
import { DEFAULT_WINDOW, addDays, occupancy, peakHours, periods, topHours, type Slot, type Window } from "./portal-metrics-calc";

const router: IRouter = Router();
router.use("/portal", cookieParser());

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (res: import("express").Response, status: number, error: string) => { res.status(status).json({ error }); };
const MAX_BACK_DAYS = 366, MAX_ROWS = 500;

export async function occupancyWindow(): Promise<Window> {
  const [row] = await db.select().from(portalSettingsTable).where(eq(portalSettingsTable.key, "occupancy_window"));
  const v = row?.value as Window | undefined;
  return v && Array.isArray(v.weekdays) ? v : DEFAULT_WINDOW;
}

// Past (and upcoming) bookings, up to a year back, for admins. Read-only here; future ones are edited from the calendar.
router.get("/portal/admin/bookings", managerGuard, asyncRoute(async (req, res) => {
  const today = partsOf(new Date()).date;
  const from = isValidDate(req.query.from) ? req.query.from : addDays(today, -30);
  const to = isValidDate(req.query.to) ? req.query.to : addDays(today, 30);
  if (from < addDays(today, -MAX_BACK_DAYS)) { bad(res, 400, "Bookings are kept for one year back."); return; }
  if (to < from) { bad(res, 400, "The end date is before the start date."); return; }
  const roomId = String(req.query.roomId ?? "");
  const q = String(req.query.q ?? "").trim().slice(0, 80);
  const where = and(
    gte(portalBookingsTable.startsAt, lisbonToUtc(from, "00:00")), lt(portalBookingsTable.startsAt, lisbonToUtc(addDays(to, 1), "00:00")),
    UUID.test(roomId) ? eq(portalBookingsTable.roomId, roomId) : undefined,
    q ? or(ilike(portalBookingsTable.title, `%${q}%`), ilike(portalBookingsTable.bookedFor, `%${q}%`), ilike(portalBookingsTable.notes, `%${q}%`), ilike(portalClientsTable.name, `%${q}%`)) : undefined,
  );
  const rows = await db.select({ b: portalBookingsTable, owner: portalClientsTable.name, room: portalRoomsTable.name }).from(portalBookingsTable)
    .innerJoin(portalClientsTable, eq(portalClientsTable.id, portalBookingsTable.clientId)).innerJoin(portalRoomsTable, eq(portalRoomsTable.id, portalBookingsTable.roomId))
    .where(where).orderBy(desc(portalBookingsTable.startsAt)).limit(MAX_ROWS + 1);
  const now = new Date();
  res.json({
    truncated: rows.length > MAX_ROWS, from, to,
    rows: rows.slice(0, MAX_ROWS).map(({ b, owner, room }) => ({ id: b.id, roomId: b.roomId, room, title: b.title, bookedFor: b.bookedFor, owner, notes: b.notes, startsAt: b.startsAt.toISOString(), endsAt: b.endsAt.toISOString(), past: b.endsAt <= now })),
  });
}));

// Occupancy (% of the working window that rooms are booked) by week or month, per room and overall, plus peak hours.
router.get("/portal/admin/metrics", managerGuard, asyncRoute(async (req, res) => {
  const granularity = req.query.granularity === "month" ? "month" : "week";
  const max = granularity === "week" ? 26 : 24;
  const count = Math.min(max, Math.max(1, Number(req.query.periods) || 12));
  const today = partsOf(new Date()).date;
  const window = await occupancyWindow();
  const ps = periods(granularity, count, today);
  const rangeStart = ps[0]!.start, rangeEnd = ps[ps.length - 1]!.end;
  const rooms = await db.select().from(portalRoomsTable).orderBy(asc(portalRoomsTable.sortOrder), asc(portalRoomsTable.name));
  const rows = await db.select().from(portalBookingsTable)
    .where(and(lt(portalBookingsTable.startsAt, lisbonToUtc(addDays(rangeEnd, 2), "00:00")), sql`${portalBookingsTable.endsAt} > ${lisbonToUtc(addDays(rangeStart, -1), "00:00")}`));
  const slots: Slot[] = rows.map((b) => ({ roomId: b.roomId, startsAt: b.startsAt, endsAt: b.endsAt }));
  const roomIds = rooms.map((r) => r.id);
  const occ = occupancy(slots, ps, window, roomIds);
  const overallPeak = peakHours(slots, rangeStart, rangeEnd);
  const byRoomPeak = Object.fromEntries(roomIds.map((id) => [id, peakHours(slots, rangeStart, rangeEnd, id)]));
  res.json({
    granularity, window, today, range: { from: rangeStart, to: rangeEnd }, currentKey: ps[ps.length - 1]!.key,
    rooms: rooms.map((r) => ({ id: r.id, name: r.name, color: r.color })),
    overall: occ.overall, byRoom: occ.byRoom,
    peak: { overall: overallPeak, byRoom: byRoomPeak, top: topHours(overallPeak, 3) },
  });
}));

export default router;
