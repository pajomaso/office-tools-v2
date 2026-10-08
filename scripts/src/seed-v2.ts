// Fake data for LOCAL development of office tool v2. Wipes the portal tables first.
// Refuses to run unless DATABASE_URL points at this machine, so it can never touch production.
import {
  db, portalClientsTable, portalCompaniesTable, portalRoomsTable, portalSettingsTable, portalTagsTable, portalBookingsTable,
  portalItemsTable, portalItemFollowsTable, portalMessagesTable, portalBlocksTable, portalTagRequestsTable, portalSessionsTable, portalLoginTokensTable,
} from "@workspace/db";

const host = (() => { try { return new URL(process.env.DATABASE_URL ?? "").hostname; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(host)) {
  console.error(`Refusing to seed: DATABASE_URL host is "${host || "unset"}", not localhost.`);
  process.exit(1);
}

async function main() {
  console.log("Seeding v2 fake data (local only)…");
  for (const t of [portalSessionsTable, portalLoginTokensTable, portalTagRequestsTable, portalItemFollowsTable, portalItemsTable, portalMessagesTable,
    portalBlocksTable, portalBookingsTable, portalTagsTable, portalSettingsTable, portalRoomsTable, portalClientsTable, portalCompaniesTable]) {
    await db.delete(t);
  }

  const rooms = await db.insert(portalRoomsTable).values([
    { name: "Alfa", seats: 4, color: "#045CFC", sortOrder: 0 },
    { name: "Bravo", seats: 4, color: "#16A34A", sortOrder: 1 }, // spec says 4 (marked "??4 or 2??" in one place)
    { name: "Charlie", seats: 6, color: "#D97706", sortOrder: 2 },
  ]).returning();

  const [subvisual, norte] = await db.insert(portalCompaniesTable).values([{ name: "Subvisual" }, { name: "Studio Norte" }]).returning();
  const people = [
    { email: "admin1@example.test", name: "Admin One", companyId: subvisual!.id, role: "admin" },
    { email: "admin2@example.test", name: "Admin Two", companyId: subvisual!.id, role: "admin" },
    { email: "admin3@example.test", name: "Admin Three", companyId: subvisual!.id, role: "admin" },
    { email: "ana@example.test", name: "Ana Costa", companyId: subvisual!.id, role: "user" },
    { email: "bruno@example.test", name: "Bruno Lima", companyId: subvisual!.id, role: "user" },
    { email: "carla@example.test", name: "Carla Dias", companyId: norte!.id, role: "user" },
    { email: "diogo@example.test", name: "Diogo Reis", companyId: norte!.id, role: "user" },
    { email: "guest@example.test", name: "Event Guest", companyId: null, role: "user", kind: "event" },
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
    { number: "T-010", clientId: null, status: "pending" }, // assigned to Bruno once the supplier confirms (see the request below)
  ]);

  await db.insert(portalTagRequestsTable).values({ clientId: by("bruno@example.test"), kind: "new", newTagNumber: "T-010", note: "Onboarding" });

  await db.insert(portalSettingsTable).values([
    { key: "capacity", value: 10 },
    { key: "supplier", value: { name: "", email: "" } },
    { key: "info", value: { office: "Office 42", city: "Braga", address: "", managerContact: "", rules: [] } },
    { key: "wifi", value: [
      { label: "Guest WiFi", visibility: "everyone", ssid: "Office-Guest", password: "guest-fake-pass", note: "Share freely with visitors." },
      { label: "Internal WiFi", visibility: "subvisual", ssid: "Office-Internal", password: "internal-fake-pass", note: "Subvisual accounts only." },
    ] },
  ]);
  const day = 86_400_000, hour = 3_600_000;
  await db.insert(portalMessagesTable).values([
    { authorId: by("admin1@example.test"), body: "Fire drill on Thursday at 11:00. Meet at the car park.", pinned: true, expiresAt: new Date(Date.now() + 3 * day) },
    { authorId: by("ana@example.test"), body: "Anyone up for lunch at 13:00?", expiresAt: new Date(Date.now() + 7 * day) },
    { authorId: by("carla@example.test"), body: "Found a black umbrella in Charlie. It is on the shelf.", expiresAt: new Date(Date.now() - 2 * day) },
  ]);
  const items = await db.insert(portalItemsTable).values([
    { authorId: by("ana@example.test"), kind: "issue", visibility: "public", title: "Projector in Alfa won't turn on", body: "Tried two remotes." },
    { authorId: by("carla@example.test"), kind: "request", visibility: "public", title: "More coffee capsules", status: "claimed", claimedBy: by("admin2@example.test"), statusNote: "Ordered, arrives Friday" },
    { authorId: by("diogo@example.test"), kind: "request", visibility: "private", title: "Second monitor for my desk" },
  ]).returning();
  await db.insert(portalItemFollowsTable).values(items.map((i) => ({ itemId: i.id, userId: i.authorId })));
  // Whole half hours, like the booking form produces.
  const at = (h: number) => new Date(Math.round((Date.now() + h * hour) / (30 * 60_000)) * 30 * 60_000);
  await db.insert(portalBookingsTable).values({ roomId: rooms[0]!.id, clientId: by("ana@example.test"), title: "Client call", bookedFor: "Rui (client)", startsAt: at(24), endsAt: at(25) });
  await db.insert(portalBlocksTable).values({ roomId: null, kind: "cleaning", title: "Weekly cleaning", startsAt: at(48), endsAt: at(49), createdBy: by("admin1@example.test") });
  console.log("  3 rooms, 8 users (3 admins, 2 companies, 1 event guest), 10 tags. Sign in as admin1@example.test (link is shown on screen locally).");
  process.exit(0);
}
main();
