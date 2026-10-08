import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { assertProductionConfig, publicBase } from "./portal-config";

const KEYS = ["NODE_ENV", "PORTAL_URL", "PORTAL_CODE_KEY", "DATABASE_URL"] as const;
let saved: Record<string, string | undefined> = {};
beforeEach(() => { saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]])); });
afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });
const good = () => { process.env.NODE_ENV = "production"; process.env.DATABASE_URL = "postgres://x"; process.env.PORTAL_URL = "https://office.example.com/"; process.env.PORTAL_CODE_KEY = Buffer.alloc(32, 7).toString("base64"); };

test("locally, links use the address the page passes in", () => {
  process.env.NODE_ENV = "development";
  assert.equal(publicBase("http://localhost:5199/"), "http://localhost:5199");
  assert.equal(publicBase(undefined), "http://localhost:5174");
});

test("in production links ALWAYS use the configured address, never one from the request", () => {
  good();
  assert.equal(publicBase("https://evil.example"), "https://office.example.com");
  assert.equal(publicBase(undefined), "https://office.example.com");
});

test("production refuses to start with missing or unsafe settings", () => {
  good(); assert.doesNotThrow(() => assertProductionConfig());
  good(); delete process.env.PORTAL_URL; assert.throws(() => assertProductionConfig(), /PORTAL_URL/);
  good(); delete process.env.PORTAL_CODE_KEY; assert.throws(() => assertProductionConfig(), /PORTAL_CODE_KEY/);
  good(); process.env.PORTAL_URL = "http://office.example.com"; assert.throws(() => assertProductionConfig(), /https/);
  good(); process.env.PORTAL_CODE_KEY = "c2hvcnQ="; assert.throws(() => assertProductionConfig(), /32 bytes/);
});

test("outside production nothing is required", () => {
  process.env.NODE_ENV = "development"; delete process.env.PORTAL_URL; delete process.env.PORTAL_CODE_KEY;
  assert.doesNotThrow(() => assertProductionConfig());
});
