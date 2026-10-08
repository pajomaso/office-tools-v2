import { db, portalClientsTable, portalRoomsTable, portalSettingsTable, portalTagsTable } from "@workspace/db";
import { count, eq } from "drizzle-orm";

async function main() {
  console.log("Seeding portal…");

  // Subvisual team: no desk or room limit, but must book. Paulo also acts as the office manager.
  await db.insert(portalClientsTable)
    .values({ email: "paulo@subvisual.co", name: "Paulo", plan: "Subvisual team", role: "manager", deskDaysPerMonth: null, roomDaysPerMonth: null })
    .onConflictDoUpdate({ target: portalClientsTable.email, set: { plan: "Subvisual team", role: "manager", deskDaysPerMonth: null, roomDaysPerMonth: null } });

  // A tenant with quotas, to exercise the allowance rules (15 desk days → 2 room days).
  await db.insert(portalClientsTable)
    .values({ email: "tenant@example.test", name: "Test Tenant", plan: "Tenant · 15 desk days", deskDaysPerMonth: 15, roomDaysPerMonth: 2, legalName: "Test Tenant, Lda", vatNumber: "000000000", billingAddress: "Rua de Teste 1, Braga", billingContact: "billing@example.test", priceCents: 12000 })
    .onConflictDoUpdate({ target: portalClientsTable.email, set: { legalName: "Test Tenant, Lda", vatNumber: "000000000", billingAddress: "Rua de Teste 1, Braga", billingContact: "billing@example.test", priceCents: 12000 } });
  const [paulo] = await db.select().from(portalClientsTable).where(eq(portalClientsTable.email, "paulo@subvisual.co"));
  await db.insert(portalTagsTable).values({ number: "0042", clientId: paulo.id, access: "Front door, 24/7", status: "active" }).onConflictDoNothing();
  console.log("  clients: paulo@subvisual.co (manager, unlimited), tenant@example.test (15 desk / 2 room days)");

  const [{ value: rooms }] = await db.select({ value: count() }).from(portalRoomsTable);
  if (Number(rooms) === 0) {
    await db.insert(portalRoomsTable).values({ name: "Room 1", seats: 4, color: "#045CFC", sortOrder: 0 });
    console.log("  rooms: Room 1 (4 seats)");
  }

  await db.insert(portalSettingsTable).values([
    { key: "capacity", value: 10 },
    { key: "supplier", value: { name: "", email: "" } }, // PLACEHOLDER: tag supplier contact still to fill in // PLACEHOLDER: real number of desk seats still to confirm
    { key: "info", value: { office: "Office 42", city: "Braga", address: "", managerContact: "", rules: [] } },
    { key: "wifi", value: [{ label: "Guest WiFi", visibility: "Public", ssid: "Office-Guest", password: "", note: "Share freely with visitors." }] },
    {
      key: "videos",
      value: [
        { title: "Disarm the alarm", duration: "1:24", description: "Use the keypad next to the entrance when you arrive.", url: "" },
        { title: "Open the front door", duration: "0:48", description: "Tag in, wait for the green light, then push.", url: "" },
        { title: "Arm the alarm & lock up", duration: "1:52", description: "End-of-day routine: arm the alarm, then pull the door.", url: "" },
      ],
    },
  ]).onConflictDoNothing();
  void eq;
  console.log("Done.");
  process.exit(0);
}
main();
