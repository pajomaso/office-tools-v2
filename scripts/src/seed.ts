import { db, roomsTable, vendorsTable, scheduledMaintenanceTable } from "@workspace/db";
import { count } from "drizzle-orm";

async function seedRooms() {
  const [{ value }] = await db.select({ value: count() }).from(roomsTable);
  if (Number(value) > 0) { console.log("  rooms: already seeded, skipping"); return; }

  await db.insert(roomsTable).values([
    { name: "The Boardroom",       description: "Main conference room",  capacity: 12 },
    { name: "The Huddle Pod",      description: "Small team meetings",   capacity: 6  },
    { name: "The Innovation Lab",  description: "Workshop & ideation",   capacity: 20 },
  ]);
  console.log("  rooms: 3 rooms created");
}

async function seedVendors() {
  const [{ value }] = await db.select({ value: count() }).from(vendorsTable);
  if (Number(value) > 0) { console.log("  vendors: already seeded, skipping"); return; }

  await db.insert(vendorsTable).values([
    { name: "FastFix Plumbing",   specialty: "Plumbing",     phone: "+351 910 000 001" },
    { name: "Spark Electric",     specialty: "Electrician",  phone: "+351 910 000 002" },
    { name: "CoolAir HVAC",       specialty: "HVAC",         phone: "+351 910 000 003" },
    { name: "TechSupport Pro",    specialty: "IT",           phone: "+351 910 000 004" },
  ]);
  console.log("  vendors: 4 vendors created");
}

async function seedScheduledMaintenance() {
  const [{ value }] = await db.select({ value: count() }).from(scheduledMaintenanceTable);
  if (Number(value) > 0) { console.log("  scheduled maintenance: already seeded, skipping"); return; }

  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const daysOut = (n: number) => fmt(new Date(today.getTime() + n * 86_400_000));

  await db.insert(scheduledMaintenanceTable).values([
    { taskName: "AC filter cleaning",       frequencyDays: 90,  nextDue: daysOut(30) },
    { taskName: "Fire extinguisher check",  frequencyDays: 365, nextDue: daysOut(60) },
    { taskName: "Elevator inspection",      frequencyDays: 180, nextDue: daysOut(45) },
    { taskName: "Pest control",             frequencyDays: 90,  nextDue: daysOut(15) },
  ]);
  console.log("  scheduled maintenance: 4 tasks created");
}

async function main() {
  console.log("Seeding database…");
  await seedRooms();
  await seedVendors();
  await seedScheduledMaintenance();
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
