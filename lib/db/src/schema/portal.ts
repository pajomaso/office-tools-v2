import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, unique, primaryKey, customType } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });


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
  bookedFor: text("booked_for"), // set when booking on someone else's behalf
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Room photos live in the database (small images), served by the API.
export const portalRoomPhotosTable = pgTable("portal_room_photos", {
  roomId: uuid("room_id").primaryKey().references(() => portalRoomsTable.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(),
  data: bytea("data").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Cleaning and maintenance slots. roomId null = every room. Bookings can't overlap them.
export const portalBlocksTable = pgTable("portal_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id").references(() => portalRoomsTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // "cleaning" | "maintenance"
  title: text("title").notNull().default(""),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  createdBy: uuid("created_by").references(() => portalClientsTable.id, { onDelete: "set null" }),
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
// Issues ("something is broken") and requests ("I need something"). Public ones can be followed by everyone;
// private ones are seen only by the author and admins. Admins claim them and leave a short status note.
export const portalItemsTable = pgTable("portal_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: uuid("author_id").notNull().references(() => portalClientsTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // "issue" | "request"
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  visibility: text("visibility").notNull().default("public"), // "public" | "private"
  status: text("status").notNull().default("open"), // "open" | "claimed" | "done"
  claimedBy: uuid("claimed_by").references(() => portalClientsTable.id, { onDelete: "set null" }),
  statusNote: text("status_note").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const portalItemFollowsTable = pgTable("portal_item_follows", {
  itemId: uuid("item_id").notNull().references(() => portalItemsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => portalClientsTable.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.itemId, t.userId] })]);

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

// Messages: anyone posts, shown until they expire (1 week by default). Admins can pin and delete any.
export const portalMessagesTable = pgTable("portal_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: uuid("author_id").notNull().references(() => portalClientsTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  pinned: boolean("pinned").notNull().default(false),
  expiresAt: timestamp("expires_at").notNull(),
  editedAt: timestamp("edited_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
