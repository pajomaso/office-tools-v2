// Settings that must be right in production. Fails at start-up, not halfway through a request.
const isProd = () => process.env.NODE_ENV === "production"; // read at call time so tests can switch it

const REQUIRED_IN_PRODUCTION: [name: string, why: string][] = [
  ["PORTAL_URL", "the public address of the site (https://…), used in every sign-in and supplier link"],
  ["PORTAL_CODE_KEY", "the key that encrypts door codes (32 random bytes, base64)"],
  ["DATABASE_URL", "the database"],
];

export function assertProductionConfig() {
  if (!isProd()) return;
  const missing = REQUIRED_IN_PRODUCTION.filter(([n]) => !process.env[n]);
  if (missing.length) throw new Error("Missing settings for production:\n" + missing.map(([n, w]) => `  - ${n}: ${w}`).join("\n"));
  if (!/^https:\/\//.test(process.env.PORTAL_URL!)) throw new Error("PORTAL_URL must start with https:// in production.");
  if (Buffer.from(process.env.PORTAL_CODE_KEY!, "base64").length !== 32) throw new Error("PORTAL_CODE_KEY must be 32 bytes, base64-encoded.");
}

/**
 * The address links point at. In production it is ALWAYS the configured one: never taken from the request, because an
 * attacker could otherwise ask for someone's sign-in link with a look-alike address and catch the secret.
 * Locally the page passes its own address so links open on whichever port it runs on.
 */
export function publicBase(requested?: unknown): string {
  if (isProd()) return process.env.PORTAL_URL!.replace(/\/+$/, "");
  return String(requested || "http://localhost:5174").replace(/\/+$/, "");
}
