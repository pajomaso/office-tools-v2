import { createCipheriv, createDecipheriv, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual, type BinaryLike } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: BinaryLike, salt: BinaryLike, len: number) => Promise<Buffer>;

// ── Passwords ───────────────────────────────────────────────────────────────
// scrypt with a random salt. The stored string can't be turned back into the password.
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  // Always do the same work, so a missing account or password isn't detectable from timing.
  const [, saltB64, hashB64] = (stored ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64")).split("$");
  const expected = Buffer.from(hashB64 ?? "", "base64");
  const actual = await scrypt(password, Buffer.from(saltB64 ?? "", "base64"), expected.length || 64);
  return !!stored && expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ── Door codes ──────────────────────────────────────────────────────────────
// Stored encrypted (AES-256-GCM) so the owner can be shown it, plus a keyed fingerprint (HMAC) that
// is unique per code, so two tags can never share a code without the code itself being readable.
function key(): Buffer {
  const raw = process.env.PORTAL_CODE_KEY;
  if (raw) {
    const k = Buffer.from(raw, "base64");
    if (k.length !== 32) throw new Error("PORTAL_CODE_KEY must be 32 bytes, base64-encoded.");
    return k;
  }
  if (process.env.NODE_ENV === "production") throw new Error("PORTAL_CODE_KEY is required in production.");
  return Buffer.alloc(32, "local-dev-only-key"); // fake local data only
}

export const isValidCode = (c: unknown): c is string => typeof c === "string" && /^\d{4}$/.test(c);

export function codeFingerprint(code: string): string {
  return createHmac("sha256", key()).update("code-fp:" + code).digest("hex");
}

export function encryptCode(code: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(code, "utf8"), c.final()]);
  return `${iv.toString("base64")}.${c.getAuthTag().toString("base64")}.${enc.toString("base64")}`;
}

export function decryptCode(stored: string): string {
  const [iv, tag, enc] = stored.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
