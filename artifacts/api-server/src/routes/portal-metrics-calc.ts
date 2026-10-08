import { lisbonToUtc, partsOf } from "./portal-time";

// Pure maths for the occupancy metrics, in Braga time, with no database. See portal-metrics-calc.test.ts.
export type Window = { startHour: number; endHour: number; weekdays: number[] }; // weekdays: 0 = Sunday … 6 = Saturday
export const DEFAULT_WINDOW: Window = { startHour: 8, endHour: 20, weekdays: [1, 2, 3, 4, 5] };
export type Slot = { roomId: string; startsAt: Date; endsAt: Date };
export type Period = { key: string; label: string; start: string; end: string }; // start/end are inclusive "YYYY-MM-DD"

const utcNoon = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y!, m! - 1, d!, 12)); };
export const addDays = (s: string, n: number) => { const d = utcNoon(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const dow = (s: string) => utcNoon(s).getUTCDay();
export const mondayOf = (s: string) => addDays(s, -((dow(s) + 6) % 7));
const monthEnd = (s: string) => { const d = utcNoon(s); d.setUTCMonth(d.getUTCMonth() + 1, 0); return d.toISOString().slice(0, 10); };
const eachDay = (a: string, b: string) => { const out: string[] = []; for (let d = a; d <= b; d = addDays(d, 1)) out.push(d); return out; };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The last `count` weeks (Monday to Sunday) or months, oldest first, ending with the one that contains `today`. */
export function periods(granularity: "week" | "month", count: number, today: string): Period[] {
  const out: Period[] = [];
  if (granularity === "week") {
    const cur = mondayOf(today);
    for (let i = count - 1; i >= 0; i--) {
      const start = addDays(cur, -7 * i), end = addDays(start, 6);
      const [, sm, sd] = start.split("-").map(Number), [, em, ed] = end.split("-").map(Number);
      out.push({ key: start, start, end, label: sm === em ? `${sd}–${ed} ${MONTHS[em! - 1]}` : `${sd} ${MONTHS[sm! - 1]}–${ed} ${MONTHS[em! - 1]}` });
    }
  } else {
    const [cy, cm] = today.split("-").map(Number);
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(cy!, cm! - 1 - i, 1));
      const start = d.toISOString().slice(0, 10);
      out.push({ key: start.slice(0, 7), start, end: monthEnd(start), label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` });
    }
  }
  return out;
}

export const windowHoursOn = (date: string, w: Window) => (w.weekdays.includes(dow(date)) ? w.endHour - w.startHour : 0);
export const availableHours = (p: Period, w: Window) => eachDay(p.start, p.end).reduce((s, d) => s + windowHoursOn(d, w), 0);

/** Hours of a slot that fall inside the working window of one calendar day. */
export function overlapHours(slot: Slot, date: string, w: Window): number {
  if (!w.weekdays.includes(dow(date))) return 0;
  const from = Math.max(+slot.startsAt, +lisbonToUtc(date, `${String(w.startHour).padStart(2, "0")}:00`));
  const to = Math.min(+slot.endsAt, +lisbonToUtc(date, `${String(w.endHour).padStart(2, "0")}:00`));
  return Math.max(0, to - from) / 3_600_000;
}

export function bookedHours(slots: Slot[], p: Period, w: Window, roomId?: string): number {
  let total = 0;
  for (const s of slots) {
    if (roomId && s.roomId !== roomId) continue;
    // A booking is attributed to the days it covers (normally just the one it starts on).
    const first = partsOf(s.startsAt).date, last = partsOf(new Date(+s.endsAt - 1)).date;
    for (const d of eachDay(first, last)) if (d >= p.start && d <= p.end) total += overlapHours(s, d, w);
  }
  return total;
}

export type Point = { key: string; label: string; booked: number; available: number; pct: number };
const pct = (booked: number, available: number) => (available > 0 ? Math.round((booked / available) * 1000) / 10 : 0);

export function occupancy(slots: Slot[], ps: Period[], w: Window, roomIds: string[]): { overall: Point[]; byRoom: Record<string, Point[]> } {
  const point = (p: Period, booked: number, available: number): Point => ({ key: p.key, label: p.label, booked: Math.round(booked * 100) / 100, available, pct: pct(booked, available) });
  const byRoom: Record<string, Point[]> = {};
  for (const id of roomIds) byRoom[id] = ps.map((p) => point(p, bookedHours(slots, p, w, id), availableHours(p, w)));
  const overall = ps.map((p) => point(p, bookedHours(slots, p, w), availableHours(p, w) * roomIds.length));
  return { overall, byRoom };
}

/** Booked hours per clock hour of the day (index 0–23, Braga time) over a date range. Counts all 24 hours, not only the working window. */
export function peakHours(slots: Slot[], rangeStart: string, rangeEnd: string, roomId?: string): number[] {
  const out = Array<number>(24).fill(0);
  const lo = +lisbonToUtc(rangeStart, "00:00"), hi = +lisbonToUtc(addDays(rangeEnd, 1), "00:00");
  const STEP = 15 * 60_000;
  for (const s of slots) {
    if (roomId && s.roomId !== roomId) continue;
    for (let t = Math.max(+s.startsAt, lo); t < Math.min(+s.endsAt, hi); t += STEP) out[partsOf(new Date(t)).h]! += STEP / 3_600_000;
  }
  return out.map((v) => Math.round(v * 100) / 100);
}

export const topHours = (hours: number[], n = 3) => hours.map((h, i) => ({ hour: i, booked: h })).filter((x) => x.booked > 0).sort((a, b) => b.booked - a.booked || a.hour - b.hour).slice(0, n);

export function validWindow(v: unknown): Window | null {
  const w = v as Partial<Window> | null;
  if (!w || !Number.isInteger(w.startHour) || !Number.isInteger(w.endHour) || !Array.isArray(w.weekdays)) return null;
  const days = [...new Set(w.weekdays)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
  if (w.startHour! < 0 || w.endHour! > 24 || w.startHour! >= w.endHour! || !days.length) return null;
  return { startHour: w.startHour!, endHour: w.endHour!, weekdays: days };
}
