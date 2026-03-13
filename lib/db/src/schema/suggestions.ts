import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const suggestionsTable = pgTable("suggestions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category").notNull().default("General"),
  submittedBy: text("submitted_by").notNull(),
  status: text("status").notNull().default("Open"),
  adminReply: text("admin_reply"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSuggestionSchema = createInsertSchema(suggestionsTable).omit({ id: true, createdAt: true, updatedAt: true, adminReply: true, status: true });
export type InsertSuggestion = z.infer<typeof insertSuggestionSchema>;
export type Suggestion = typeof suggestionsTable.$inferSelect;
