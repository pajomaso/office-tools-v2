// One-off setup of a NEW, empty database with the real starting data: companies, the admins, and the three rooms.
// No fake data. Safe to run twice (it only adds what's missing and makes the listed people admins).
//
//   DATABASE_URL=... pnpm --filter @workspace/scripts run setup:real -- setup.json            (dry run: shows what it would do)
//   DATABASE_URL=... pnpm --filter @workspace/scripts run setup:real -- setup.json --apply    (writes)
//
// setup.json (see setup.example.json):
//   { "companies": ["Subvisual"], "admins": [{ "name": "…", "email": "…", "company": "Subvisual" }],
//     "rooms": [{ "name": "Alfa", "seats": 4 }, …] }      ← rooms only used if the database has none yet
// Door codes and tags are NOT handled here (that's the import from the Notion "Access Control" export).
import { readFileSync } from "node:fs";
import { db, pool, portalClientsTable, portalCompaniesTable, portalRoomsTable } from "@workspace/db";
import { eq, like, sql } from "drizzle-orm";

type Setup = { companies?: string[]; admins: { name: string; email: string; company?: string }[]; rooms?: { name: string; seats: number }[] };
const EMAIL = /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/;
const COLORS = ["#045CFC", "#16A34A", "#D97706", "#9333EA", "#DB2777"];
const DEFAULT_ROOMS = [{ name: "Alfa", seats: 4 }, { name: "Bravo", seats: 4 }, { name: "Charlie", seats: 6 }];

const args = process.argv.slice(2).filter((a) => a !== "--");
const file = args.find((a) => !a.startsWith("--"));
const apply = args.includes("--apply");
if (!file) { console.error("Usage: setup:real -- <setup.json> [--apply]"); process.exit(1); }

const cfg = JSON.parse(readFileSync(file, "utf8")) as Setup;
const problems: string[] = [];
if (!Array.isArray(cfg.admins) || !cfg.admins.length) problems.push("List at least one admin.");
for (const a of cfg.admins ?? []) {
  if (!a.name?.trim()) problems.push(`An admin has no name (${a.email}).`);
  if (!EMAIL.test(String(a.email ?? "").trim())) problems.push(`Not a valid email: ${a.email}`);
  if (/@example\.(test|com)$/i.test(a.email)) problems.push(`Looks like a fake address: ${a.email}`);
}
for (const r of cfg.rooms ?? []) if (!r.name?.trim() || !Number.isInteger(r.seats) || r.seats < 1) problems.push(`Bad room: ${JSON.stringify(r)}`);
if (problems.length) { console.error("Fix setup.json first:\n- " + problems.join("\n- ")); process.exit(1); }

const host = new URL(process.env.DATABASE_URL!).hostname;
console.log(`${apply ? "APPLYING to" : "Dry run (nothing written) against"} database on ${host}\n`);

// Never mix real people into a database that has the fake development data.
const [{ n: fake }] = await db.select({ n: sql<number>`count(*)::int` }).from(portalClientsTable).where(like(portalClientsTable.email, "%@example.test"));
if (fake) { console.error(`This database has ${fake} fake users (@example.test). Use a new, empty database.`); await pool.end(); process.exit(1); }

const plan: string[] = [];
await db.transaction(async (tx) => {
  const companies = new Map((await tx.select().from(portalCompaniesTable)).map((c) => [c.name.toLowerCase(), c.id]));
  const wanted = [...new Set([...(cfg.companies ?? []), ...cfg.admins.map((a) => a.company).filter((c): c is string => !!c)].map((c) => c.trim()))];
  for (const name of wanted) {
    if (companies.has(name.toLowerCase())) continue;
    plan.push(`add company "${name}"`);
    if (apply) { const [c] = await tx.insert(portalCompaniesTable).values({ name }).returning(); companies.set(name.toLowerCase(), c!.id); }
  }

  for (const a of cfg.admins) {
    const email = a.email.trim().toLowerCase(), name = a.name.trim();
    const companyId = a.company ? companies.get(a.company.trim().toLowerCase()) ?? null : null;
    const [existing] = await tx.select().from(portalClientsTable).where(eq(portalClientsTable.email, email));
    if (!existing) {
      plan.push(`add admin ${name} <${email}>${a.company ? ` (${a.company})` : ""}`);
      if (apply) await tx.insert(portalClientsTable).values({ email, name, role: "admin", kind: "company", companyId });
    } else if (existing.role !== "admin") {
      plan.push(`make ${existing.name} <${email}> an admin`);
      if (apply) await tx.update(portalClientsTable).set({ role: "admin" }).where(eq(portalClientsTable.id, existing.id));
    }
  }

  const [{ n: rooms }] = await tx.select({ n: sql<number>`count(*)::int` }).from(portalRoomsTable);
  if (!rooms) {
    const list = cfg.rooms?.length ? cfg.rooms : DEFAULT_ROOMS;
    plan.push(`add rooms: ${list.map((r) => `${r.name} (${r.seats})`).join(", ")}`);
    if (apply) await tx.insert(portalRoomsTable).values(list.map((r, i) => ({ name: r.name.trim(), seats: r.seats, color: COLORS[i % COLORS.length]!, sortOrder: i })));
  }
});

console.log(plan.length ? plan.map((p) => `- ${p}`).join("\n") : "Nothing to do: everything is already there.");
if (!apply && plan.length) console.log("\nRun again with --apply to write this.");
if (apply && plan.length) console.log("\nDone. The admins sign in with the emailed link (once an email service is connected).");
await pool.end();
