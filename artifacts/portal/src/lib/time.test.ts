import { test } from "node:test";
import assert from "node:assert/strict";
import { hm, lisbonToUtc, ymd } from "./time";

// What the browser shows must be Braga time whatever the user's own timezone is.
test("a 09:00 booking shows as 09:00 on both sides of the 25 Oct 2026 clock change", () => {
  assert.equal(hm("2026-10-23T08:00:00.000Z"), "09:00");
  assert.equal(hm("2026-10-26T09:00:00.000Z"), "09:00");
  assert.equal(ymd("2026-10-26T09:00:00.000Z"), "2026-10-26");
});

test("a booking late in the evening stays on its own day", () => {
  assert.equal(ymd("2026-10-23T22:30:00.000Z"), "2026-10-23"); // 23:30 in Braga
  assert.equal(ymd("2026-10-24T00:30:00.000Z"), "2026-10-24"); // 01:30 in Braga
});

test("typed wall-clock time converts to the right instant and back", () => {
  for (const [d, t] of [["2026-10-23", "09:00"], ["2026-10-26", "09:00"], ["2026-10-25", "08:00"], ["2027-03-29", "09:00"]]) {
    const at = lisbonToUtc(d, t);
    assert.equal(ymd(at), d);
    assert.equal(hm(at), t);
  }
});
