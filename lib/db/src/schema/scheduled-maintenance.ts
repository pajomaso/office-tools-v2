import { pgTable, serial, text, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scheduledMaintenanceTable = pgTable("scheduled_maintenance", {
  id: serial("id").primaryKey(),
  taskName: text("task_name").notNull(),
  description: text("description"),
  frequencyDays: integer("frequency_days").notNull(),
  lastDone: date("last_done"),
  nextDue: date("next_due").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertScheduledMaintenanceSchema = createInsertSchema(scheduledMaintenanceTable).omit({ id: true, createdAt: true });
export type InsertScheduledMaintenance = z.infer<typeof insertScheduledMaintenanceSchema>;
export type ScheduledMaintenance = typeof scheduledMaintenanceTable.$inferSelect;
