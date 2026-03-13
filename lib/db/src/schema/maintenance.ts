import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const maintenanceTicketsTable = pgTable("maintenance_tickets", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  photoUrl: text("photo_url"),
  reportedBy: text("reported_by").notNull(),
  status: text("status").notNull().default("Reported"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMaintenanceTicketSchema = createInsertSchema(maintenanceTicketsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMaintenanceTicket = z.infer<typeof insertMaintenanceTicketSchema>;
export type MaintenanceTicket = typeof maintenanceTicketsTable.$inferSelect;
