import { test } from "node:test";
import assert from "node:assert/strict";
import { codeFingerprint, decryptCode, encryptCode, hashPassword, hashToken, isValidCode, verifyPassword } from "./portal-crypto";

test("passwords: right one passes, wrong one and missing account fail, hash isn't the password", async () => {
  const h = await hashPassword("correct horse battery");
  assert.ok(!h.includes("correct horse"));
  assert.equal(await verifyPassword("correct horse battery", h), true);
  assert.equal(await verifyPassword("wrong", h), false);
  assert.equal(await verifyPassword("anything", null), false);
  assert.notEqual(await hashPassword("same"), await hashPassword("same")); // random salt
});

test("door codes: round-trip, never stored readable, same code gives same fingerprint", () => {
  const enc = encryptCode("4821");
  assert.ok(!enc.includes("4821"));
  assert.equal(decryptCode(enc), "4821");
  assert.notEqual(encryptCode("4821"), encryptCode("4821")); // fresh IV each time
  assert.equal(codeFingerprint("4821"), codeFingerprint("4821"));
  assert.notEqual(codeFingerprint("4821"), codeFingerprint("4822"));
  assert.throws(() => decryptCode(enc.slice(0, -4) + "AAAA"));
});

test("a code is exactly 4 digits", () => {
  for (const ok of ["0000", "1234", "9999"]) assert.equal(isValidCode(ok), true);
  for (const bad of ["123", "12345", "12a4", "", " 123", 1234, null]) assert.equal(isValidCode(bad), false);
});

test("secret tokens are stored as a hash: same input same hash, never the input", () => {
  const raw = "Zk3-sample-token_value";
  assert.equal(hashToken(raw), hashToken(raw));
  assert.equal(hashToken(raw).length, 64);
  assert.ok(!hashToken(raw).includes(raw));
  assert.notEqual(hashToken(raw), hashToken(raw + "x"));
});
