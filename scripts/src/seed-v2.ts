// Fake data for LOCAL development of office tool v2. Wipes the portal tables first.
// Refuses to run unless DATABASE_URL points at this machine, so it can never touch production.
import {
  db, portalClientsTable, portalRoomsTable, portalSettingsTable, portalTagsTable, portalBookingsTable,
  portalDeskBookingsTable, portalReportsTable, portalTagRequestsTable, portalInvoicesTable,
  portalAnnouncementsTable, portalPostsTable, portalLeadsTable, portalSessionsTable, portalLoginTokensTable,
} from "@workspace/db";

const host = (() => { try { return new URL(process.env.DATABASE_URL ?? "").hostname; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(host)) {
  console.error(`Refusing to seed: DATABASE_URL host is "${host || "unset"}", not localhost.`);
  process.exit(1);
}

async function main() {
  console.log("Seeding v2 fake data (local only)…");
  for (const t of [portalSessionsTable, portalLoginTokensTable, portalInvoicesTable, portalTagRequestsTable, portalReportsTable, portalAnnouncementsTable,
    portalPostsTable, portalLeadsTable, portalDeskBookingsTable, portalBookingsTable, portalTagsTable, portalSettingsTable, portalRoomsTable, portalClientsTable]) {
    await db.delete(t);
  }

  await db.insert(portalRoomsTable).values([
    { name: "Alfa", seats: 4, color: "#045CFC", sortOrder: 0 },
    { name: "Bravo", seats: 4, color: "#16A34A", sortOrder: 1 }, // spec says 4 (marked "??4 or 2??" in one place)
    { name: "Charlie", seats: 6, color: "#D97706", sortOrder: 2 },
  ]);

  // The company is kept in the "plan" text for now; a real company field comes with the users/login step.
  const people = [
    { email: "admin1@example.test", name: "Admin One", plan: "Subvisual", role: "manager" },
    { email: "admin2@example.test", name: "Admin Two", plan: "Subvisual", role: "manager" },
    { email: "admin3@example.test", name: "Admin Three", plan: "Subvisual", role: "manager" },
    { email: "ana@example.test", name: "Ana Costa", plan: "Subvisual", role: "client" },
    { email: "bruno@example.test", name: "Bruno Lima", plan: "Subvisual", role: "client" },
    { email: "carla@example.test", name: "Carla Dias", plan: "Studio Norte", role: "client" },
    { email: "diogo@example.test", name: "Diogo Reis", plan: "Studio Norte", role: "client" },
  ];
  const clients = await db.insert(portalClientsTable).values(people).returning();
  const by = (email: string) => clients.find((c) => c.email === email)!.id;

  // Fake tag numbers only. No access codes anywhere (they don't exist in the schema yet).
  await db.insert(portalTagsTable).values([
    { number: "T-001", clientId: by("admin1@example.test"), status: "active" },
    { number: "T-002", clientId: by("admin2@example.test"), status: "active" },
    { number: "T-003", clientId: by("ana@example.test"), status: "active" },
    { number: "T-004", clientId: by("carla@example.test"), status: "active" },
    { number: "T-005", clientId: by("diogo@example.test"), status: "active" },
    { number: "T-006", clientId: null, status: "spare" },
    { number: "T-007", clientId: null, status: "spare" },
    { number: "T-008", clientId: null, status: "lost" },
    { number: "T-009", clientId: null, status: "blocked" },
    { number: "T-010", clientId: by("bruno@example.test"), status: "pending" },
  ]);

  await db.insert(portalSettingsTable).values([
    { key: "capacity", value: 10 },
    { key: "supplier", value: { name: "", email: "" } },
    { key: "info", value: { office: "Office 42", city: "Braga", address: "", managerContact: "", rules: [] } },
    { key: "wifi", value: [{ label: "Guest WiFi", visibility: "Public", ssid: "Office-Guest", password: "", note: "Share freely with visitors." }] },
    { key: "videos", value: [] },
  ]);
  console.log("  3 rooms, 7 users (3 admins, 2 companies), 10 tags. Sign in as admin1@example.test (link is shown on screen locally).");
  process.exit(0);
}
main();
