import { test } from "node:test";
import assert from "node:assert/strict";
import { limiter } from "./portal-rate-limit";

test("rate limit: allows up to the limit per key, then refuses; other keys are separate", () => {
  const l = limiter(3, 60_000);
  assert.deepEqual([l.hit("a"), l.hit("a"), l.hit("a"), l.hit("a")], [false, false, false, true]);
  assert.equal(l.hit("b"), false);
});

test("rate limit: the window slides", async () => {
  const l = limiter(1, 50);
  assert.equal(l.hit("a"), false);
  assert.equal(l.hit("a"), true);
  await new Promise((r) => setTimeout(r, 70));
  assert.equal(l.hit("a"), false);
});
