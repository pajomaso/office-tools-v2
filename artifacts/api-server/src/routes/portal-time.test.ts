import { test } from "node:test";
import assert from "node:assert/strict";
import { lisbonToUtc, partsOf } from "./portal-time";

// Run under several machine timezones (see the "test:time" script): results must never change.
const iso = (d: string, t: string) => lisbonToUtc(d, t).toISOString();

test("09:00 in Braga is the same wall-clock time before and after the autumn clock change (25 Oct 2026)", () => {
  assert.equal(iso("2026-10-23", "09:00"), "2026-10-23T08:00:00.000Z"); // summer time, UTC+1
  assert.equal(iso("2026-10-26", "09:00"), "2026-10-26T09:00:00.000Z"); // winter time, UTC+0
  assert.equal(iso("2026-10-25", "00:30"), "2026-10-24T23:30:00.000Z"); // still summer time
  assert.equal(iso("2026-10-25", "03:00"), "2026-10-25T03:00:00.000Z"); // already winter time
});

test("spring clock change (28 Mar 2027)", () => {
  assert.equal(iso("2027-03-27", "09:00"), "2027-03-27T09:00:00.000Z");
  assert.equal(iso("2027-03-29", "09:00"), "2027-03-29T08:00:00.000Z");
});

test("every half hour from 20 Oct to 2 Nov round-trips to the same date and time", () => {
  for (let day = 0; day < 14; day++) {
    const d = new Date(Date.UTC(2026, 9, 20 + day)).toISOString().slice(0, 10);
    for (let h = 0; h < 24; h++) for (const m of ["00", "30"]) {
      const t = `${String(h).padStart(2, "0")}:${m}`;
      if (d === "2026-10-25" && h === 1) continue; // 01:00–01:59 happens twice that night; not bookable by rule
      const p = partsOf(lisbonToUtc(d, t));
      assert.equal(p.date, d, `${d} ${t}`);
      assert.equal(`${String(p.h).padStart(2, "0")}:${String(p.min).padStart(2, "0")}`, t, `${d} ${t}`);
    }
  }
});

test("weekday and month come from Braga time, not from the machine", () => {
  const p = partsOf(new Date("2026-10-31T23:30:00Z")); // 23:30 in Braga (UTC+0), still 31 Oct, a Saturday
  assert.equal(p.month, "2026-10");
  assert.equal(p.dow, 6);
});
