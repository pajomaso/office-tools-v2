// Fake data for LOCAL development of office tool v2. Wipes the portal tables first.
// Refuses to run unless DATABASE_URL points at this machine, so it can never touch production.
import {
  db, portalClientsTable, portalCompaniesTable, portalRoomsTable, portalSettingsTable, portalTagsTable, portalBookingsTable,
  portalItemsTable, portalItemFollowsTable, portalSuppliersTable, portalMessagesTable, portalBlocksTable, portalTagChangesTable, portalTagBatchesTable, portalTagLogTable, portalAdminSeenTable, portalSessionsTable, portalLoginTokensTable,
} from "@workspace/db";

const host = (() => { try { return new URL(process.env.DATABASE_URL ?? "").hostname; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(host)) {
  console.error(`Refusing to seed: DATABASE_URL host is "${host || "unset"}", not localhost.`);
  process.exit(1);
}

async function main() {
  console.log("Seeding v2 fake data (local only)…");
  for (const t of [portalSessionsTable, portalLoginTokensTable, portalAdminSeenTable, portalTagLogTable, portalTagChangesTable, portalTagBatchesTable, portalItemFollowsTable, portalItemsTable, portalSuppliersTable, portalMessagesTable,
    portalBlocksTable, portalBookingsTable, portalTagsTable, portalSettingsTable, portalRoomsTable, portalClientsTable, portalCompaniesTable]) {
    await db.delete(t);
  }

  const rooms = await db.insert(portalRoomsTable).values([
    { name: "Alfa", seats: 4, color: "#045CFC", sortOrder: 0 },
    { name: "Bravo", seats: 4, color: "#16A34A", sortOrder: 1 }, // spec says 4 (marked "??4 or 2??" in one place)
    { name: "Charlie", seats: 6, color: "#D97706", sortOrder: 2 },
  ]).returning();

  const [subvisual, onda, xmoney] = await db.insert(portalCompaniesTable).values([{ name: "Subvisual" }, { name: "Onda" }, { name: "Xmoney" }]).returning();
  const people = [
    { email: "admin1@example.test", name: "Admin One", companyId: subvisual!.id, role: "admin" },
    { email: "admin2@example.test", name: "Admin Two", companyId: subvisual!.id, role: "admin" },
    { email: "admin3@example.test", name: "Admin Three", companyId: subvisual!.id, role: "admin" },
    { email: "ana@example.test", name: "Ana Costa", companyId: subvisual!.id, role: "user" },
    { email: "bruno@example.test", name: "Bruno Lima", companyId: subvisual!.id, role: "user" },
    { email: "carla@example.test", name: "Carla Dias", companyId: onda!.id, role: "user" },
    { email: "diogo@example.test", name: "Diogo Reis", companyId: xmoney!.id, role: "user" },
    { email: "guest@example.test", name: "Event Guest", companyId: null, role: "user", kind: "event" },
  ];
  const clients = await db.insert(portalClientsTable).values(people).returning();
  const by = (email: string) => clients.find((c) => c.email === email)!.id;

  // Fake tag numbers only. No access codes anywhere. holderName is the name registered at the supplier.
  const co = (n: string) => (n === "onda" ? onda!.id : n === "xmoney" ? xmoney!.id : subvisual!.id);
  const tagRows = await db.insert(portalTagsTable).values([
    { number: "T-001", clientId: by("admin1@example.test"), holderName: "Admin One", status: "active", accessLevel: "administrator", companyId: co("sv") },
    { number: "T-002", clientId: by("admin2@example.test"), holderName: "Admin Two", status: "active", accessLevel: "administrator", companyId: co("sv") },
    { number: "T-003", clientId: by("ana@example.test"), holderName: "Ana Costa", status: "active", companyId: co("sv") },
    { number: "T-004", clientId: by("carla@example.test"), holderName: "Carla Dias", status: "active", companyId: co("onda") },
    { number: "T-005", clientId: by("diogo@example.test"), holderName: "Diogo Reis", status: "active", companyId: co("xmoney") },
    { number: "T-006", status: "spare" },
    { number: "T-007", status: "spare" },
    { number: "T-008", status: "lost", note: "Lost in September" },
    { number: "T-009", status: "blocked", accessLevel: "service", note: "Cleaning service" },
    { number: "T-010", status: "spare" },
  ]).returning();
  // Bruno's tag is waiting for the supplier: a line in the open batch, while the tag still shows its old state.
  const [batch] = await db.insert(portalTagBatchesTable).values({ status: "open", createdBy: by("admin1@example.test") }).returning();
  await db.insert(portalTagChangesTable).values({ batchId: batch!.id, tagId: tagRows.find((t) => t.number === "T-010")!.id, kind: "assign", toUserId: by("bruno@example.test"), toName: "Bruno Lima", note: "Onboarding", createdBy: by("admin1@example.test") });

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
  const suppliers = await db.insert(portalSuppliersTable).values([
    { name: "Fast Electric", what: "Electrician", contactName: "Rui (fake)", phone: "+351 000 000 001", email: "electric@example.test", notes: "Call before 17:00" },
    { name: "Clean & Co", what: "Cleaning", contactName: "Marta (fake)", phone: "+351 000 000 002", email: "cleaning@example.test", notes: "" },
    { name: "TechHelp", what: "IT, AV and projectors", contactName: "Paulo (fake)", phone: "+351 000 000 003", email: "it@example.test", notes: "Support contract until December" },
  ]).returning();
  const items = await db.insert(portalItemsTable).values([
    { authorId: by("ana@example.test"), kind: "issue", visibility: "public", title: "Projector in Alfa won't turn on", body: "Tried two remotes.", supplierId: suppliers[2]!.id },
    { authorId: by("carla@example.test"), kind: "request", visibility: "public", title: "More coffee capsules", status: "claimed", claimedBy: by("admin2@example.test"), statusNote: "Ordered, arrives Friday" },
    { authorId: by("diogo@example.test"), kind: "request", visibility: "private", title: "Second monitor for my desk" },
  ]).returning();
  await db.insert(portalItemFollowsTable).values(items.map((i) => ({ itemId: i.id, userId: i.authorId })));
  // Whole half hours, like the booking form produces.
  const at = (h: number) => new Date(Math.round((Date.now() + h * hour) / (30 * 60_000)) * 30 * 60_000);
  // About a year of fake bookings so the history and the metrics have something to show (deterministic, so reruns match).
  let seed = 12345;
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const titles = ["Weekly sync", "Client call", "Design review", "Interview", "Workshop", "1:1", "Planning", "Demo"];
  const bookers = ["ana", "bruno", "carla", "diogo", "admin1", "admin2"].map((n) => by(`${n}@example.test`));
  const hist: (typeof portalBookingsTable.$inferInsert)[] = [];
  const day0 = new Date(); day0.setUTCHours(0, 0, 0, 0);
  for (let back = 365; back >= -21; back--) {
    const d = new Date(+day0 - back * day);
    if ([0, 6].includes(d.getUTCDay())) continue;
    const busy = 0.3 + 0.35 * Math.sin((back / 365) * Math.PI * 2 + 1) ** 2; // some seasonality
    for (const room of rooms) {
      let cursor = 8 + Math.floor(rnd() * 3); // hour of day in UTC (roughly 9-11 in Braga)
      while (cursor < 16 && rnd() < busy) {
        const len = [1, 1, 1.5, 2][Math.floor(rnd() * 4)]!;
        const start = new Date(+d + cursor * hour);
        hist.push({ roomId: room.id, clientId: bookers[Math.floor(rnd() * bookers.length)]!, title: titles[Math.floor(rnd() * titles.length)]!, startsAt: start, endsAt: new Date(+start + len * hour) });
        cursor += len + Math.floor(rnd() * 3);
      }
    }
  }
  await db.insert(portalBookingsTable).values(hist);
  await db.insert(portalBookingsTable).values({ roomId: rooms[0]!.id, clientId: by("ana@example.test"), title: "Client call", bookedFor: "Rui (client)", startsAt: at(24), endsAt: at(25) });
  await db.insert(portalBlocksTable).values({ roomId: null, kind: "cleaning", title: "Weekly cleaning", startsAt: at(48), endsAt: at(49), createdBy: by("admin1@example.test") });
  console.log(`  ${hist.length} fake bookings over a year.`);
  console.log("  3 rooms, 8 users (3 admins, 3 companies, 1 event guest), 10 tags. Sign in as admin1@example.test (link is shown on screen locally).");
  process.exit(0);
}
main();
