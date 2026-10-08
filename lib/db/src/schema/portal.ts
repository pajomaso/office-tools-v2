import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, unique } from "drizzle-orm/pg-core";


export const portalCompaniesTable = pgTable("portal_companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Everyone who uses the office. "role" is "user" or "admin" (several admins are fine, all equal).
export const portalClientsTable = pgTable("portal_clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("user"), // "user" | "admin"
  companyId: uuid("company_id").references(() => portalCompaniesTable.id, { onDelete: "set null" }),
  kind: text("kind").notNull().default("company"), // "company" | "event" (clients, meetups, one-off events)
  passwordHash: text("password_hash"), // scrypt hash; null = magic link only
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const portalRoomsTable = pgTable("portal_rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  seats: integer("seats").notNull().default(4),
  color: text("color").notNull().default("#045CFC"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const portalBookingsTable = pgTable("portal_bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id").notNull().references(() => portalRoomsTable.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => portalClientsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  attendees: integer("attendees").notNull().default(1),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const portalLoginTokensTable = pgTable("portal_login_tokens", {
  token: text("token").primaryKey(),
  clientId: uuid("client_id").notNull().references(() => portalClientsTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  purpose: text("purpose").notNull().default("login"), // "login" (15 min) | "invite" (7 days)
});

export const portalSessionsTable = pgTable("portal_sessions", {
  id: text("id").primaryKey(),
  clientId: uuid("client_id").notNull().references(() => portalClientsTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
});

export const portalSettingsTable = pgTable("portal_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

// Issues ("something is broken") and supply requests ("something is missing").
export const portalReportsTable = pgTable("portal_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => portalClientsTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // "issue" | "supply"
  title: text("title").notNull(),
  details: text("details").notNull().default(""),
  status: text("status").notNull().default("open"), // "open" | "in_progress" | "done"
  managerNote: text("manager_note").notNull().default(""),
  reporterNotified: boolean("reporter_notified").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Access tags. The supplier is contacted by email; this table is the source of truth.
export const portalTagsTable = pgTable("portal_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: text("number").notNull().unique(),
  clientId: uuid("client_id").references(() => portalClientsTable.id, { onDelete: "set null" }),
  access: text("access").notNull().default(""),
  status: text("status").notNull().default("active"), // "active" | "spare" | "lost" | "blocked" | "pending"
  // 4-digit door code: encrypted (so the owner can see it) + a fingerprint (so two tags can never share one).
  codeEnc: text("code_enc"),
  codeFp: text("code_fp").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Request log: to_send -> sent -> confirmed (or rejected). The tag table only changes on confirmation.
export const portalTagRequestsTable = pgTable("portal_tag_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => portalClientsTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // "new" | "replace" | "deactivate"
  oldTagId: uuid("old_tag_id").references(() => portalTagsTable.id, { onDelete: "set null" }),
  note: text("note").notNull().default(""),
  status: text("status").notNull().default("to_send"), // "to_send" | "sent" | "confirmed" | "rejected"
  newTagNumber: text("new_tag_number"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Phase 3 — community. Announcements: manager -> everyone. Board: everyone -> everyone.
export const portalAnnouncementsTable = pgTable("portal_announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: uuid("author_id").notNull().references(() => portalClientsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  pinned: boolean("pinned").notNull().default(false), // pinned = highlighted as relevant
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const portalPostsTable = pgTable("portal_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: uuid("author_id").notNull().references(() => portalClientsTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

