import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, unique, customType } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

export const portalClientsTable = pgTable("portal_clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("Members"),
  // Monthly allowances. null = unlimited (e.g. the Subvisual team).
  deskDaysPerMonth: integer("desk_days_per_month"),
  roomDaysPerMonth: integer("room_days_per_month"),
  role: text("role").notNull().default("client"), // "client" | "manager"
  // Billing record (invoices are issued manually; the portal only stores the details and the PDFs).
  legalName: text("legal_name"),
  vatNumber: text("vat_number"),
  billingAddress: text("billing_address"),
  billingContact: text("billing_contact"),
  priceCents: integer("price_cents"), // monthly price; null = not billed (e.g. the Subvisual team)
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

// Hot desks: a booking is a seat for a day, not a specific desk.
export const portalDeskBookingsTable = pgTable(
  "portal_desk_bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").notNull().references(() => portalClientsTable.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD, Europe/Lisbon calendar day
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("portal_desk_client_date").on(t.clientId, t.date)],
);

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
  status: text("status").notNull().default("active"), // "active" | "lost" | "disabled"
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

export const portalInvoicesTable = pgTable(
  "portal_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").notNull().references(() => portalClientsTable.id, { onDelete: "cascade" }),
    period: text("period").notNull(), // YYYY-MM
    number: text("number").notNull().default(""),
    amountCents: integer("amount_cents"),
    filename: text("filename").notNull(),
    data: bytea("data").notNull(),
    uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  },
  (t) => [unique("portal_invoice_client_period_number").on(t.clientId, t.period, t.number)],
);

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

// Public page: prospective tenants signal interest without commitment.
export const portalLeadsTable = pgTable("portal_leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company").notNull().default(""),
  interest: text("interest").notNull().default("other"), // "desk" | "room" | "other"
  message: text("message").notNull().default(""),
  status: text("status").notNull().default("new"), // "new" | "contacted"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
