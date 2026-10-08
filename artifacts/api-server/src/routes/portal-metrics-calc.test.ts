import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_WINDOW as W, availableHours, bookedHours, occupancy, peakHours, periods, topHours, validWindow } from "./portal-metrics-calc";
import { lisbonToUtc } from "./portal-time";

const slot = (roomId: string, date: string, start: string, end: string) => ({ roomId, startsAt: lisbonToUtc(date, start), endsAt: lisbonToUtc(date, end) });

test("periods end with the one that contains today, oldest first", () => {
  const weeks = periods("week", 3, "2026-10-08");
  assert.deepEqual(weeks.map((p) => p.start), ["2026-09-21", "2026-09-28", "2026-10-05"]);
  assert.equal(weeks[2]!.end, "2026-10-11");
  const months = periods("month", 3, "2026-10-08");
  assert.deepEqual(months.map((p) => [p.start, p.end]), [["2026-08-01", "2026-08-31"], ["2026-09-01", "2026-09-30"], ["2026-10-01", "2026-10-31"]]);
  assert.equal(periods("month", 2, "2026-01-15")[0]!.label, "Dec 2025");
});

test("a working week has 5 days x 12 hours available per room", () => {
  const [wk] = periods("week", 1, "2026-10-08");
  assert.equal(availableHours(wk!, W), 60);
  assert.equal(availableHours(periods("month", 1, "2026-10-08")[0]!, W), 22 * 12); // October 2026 has 22 weekdays
});

test("occupancy is booked hours over available hours", () => {
  const [wk] = periods("week", 1, "2026-10-08");
  const slots = [slot("a", "2026-10-05", "09:00", "11:00"), slot("a", "2026-10-06", "14:00", "15:30")];
  assert.equal(bookedHours(slots, wk!, W, "a"), 3.5);
  const o = occupancy(slots, [wk!], W, ["a", "b"]);
  assert.equal(o.byRoom.a![0]!.pct, 5.8); // 3.5 / 60
  assert.equal(o.byRoom.b![0]!.pct, 0);
  assert.equal(o.overall[0]!.pct, 2.9); // two rooms: 3.5 / 120
});

test("only the part inside the working window counts, weekends and nights don't", () => {
  const [wk] = periods("week", 1, "2026-10-08");
  assert.equal(bookedHours([slot("a", "2026-10-05", "19:00", "21:00")], wk!, W), 1); // 19-20 only
  assert.equal(bookedHours([slot("a", "2026-10-05", "22:00", "23:30")], wk!, W), 0);
  assert.equal(bookedHours([slot("a", "2026-10-10", "10:00", "12:00")], wk!, W), 0); // Saturday
  assert.equal(bookedHours([slot("a", "2026-10-10", "10:00", "12:00")], wk!, { ...W, weekdays: [1, 2, 3, 4, 5, 6] }), 2);
});

test("a booking is counted in the period of its Braga date, even late in the evening", () => {
  const [prev, cur] = periods("week", 2, "2026-10-08");
  const s = [slot("a", "2026-10-04", "10:00", "11:00")]; // Sunday: belongs to the previous week
  assert.equal(bookedHours(s, prev!, { ...W, weekdays: [0, 1, 2, 3, 4, 5, 6] }), 1);
  assert.equal(bookedHours(s, cur!, { ...W, weekdays: [0, 1, 2, 3, 4, 5, 6] }), 0);
});

test("peak hours cover all 24 hours and stay on the same clock hour across the 25 Oct clock change", () => {
  const slots = [slot("a", "2026-10-23", "09:00", "10:00"), slot("a", "2026-10-26", "09:00", "10:00"), slot("b", "2026-10-26", "22:00", "23:30")];
  const h = peakHours(slots, "2026-10-20", "2026-10-31");
  assert.equal(h[9], 2); // both 09:00 bookings, before and after the change
  assert.equal(h[22], 1);
  assert.equal(h[23], 0.5);
  assert.equal(h.reduce((a, b) => a + b, 0), 3.5); // nothing lost or doubled
  assert.equal(peakHours(slots, "2026-10-20", "2026-10-31", "b")[9], 0);
  assert.deepEqual(topHours(h, 2), [{ hour: 9, booked: 2 }, { hour: 22, booked: 1 }]);
});

test("working window must make sense", () => {
  assert.deepEqual(validWindow({ startHour: 8, endHour: 20, weekdays: [5, 1, 1, 2] }), { startHour: 8, endHour: 20, weekdays: [1, 2, 5] });
  for (const bad of [null, { startHour: 20, endHour: 8, weekdays: [1] }, { startHour: 8, endHour: 25, weekdays: [1] }, { startHour: 8, endHour: 20, weekdays: [] }, { startHour: 8.5, endHour: 20, weekdays: [1] }]) assert.equal(validWindow(bad), null);
});
