import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const inventoryRequestsTable = pgTable("inventory_requests", {
  id: serial("id").primaryKey(),
  itemName: text("item_name").notNull(),
  category: text("category").notNull(),
  urgency: text("urgency").notNull(),
  requestedBy: text("requested_by").notNull(),
  upvotes: integer("upvotes").notNull().default(0),
  status: text("status").notNull().default("Pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInventoryRequestSchema = createInsertSchema(inventoryRequestsTable).omit({ id: true, createdAt: true, upvotes: true });
export type InsertInventoryRequest = z.infer<typeof insertInventoryRequestSchema>;
export type InventoryRequest = typeof inventoryRequestsTable.$inferSelect;
