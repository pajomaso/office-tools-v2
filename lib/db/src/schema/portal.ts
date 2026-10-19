import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, unique, uniqueIndex, primaryKey, customType } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
  deactivatedAt: timestamp("deactivated_at"), // set when someone leaves: they can no longer sign in; their history stays
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

// Photos admins upload for the guides in the personal area. A guide shows one by having its link on a line of its own.
export const portalGuidePhotosTable = pgTable("portal_guide_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentType: text("content_type").notNull(),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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

// Suppliers the admins call when handling an issue (electrician, cleaning, IT...). Not the tag supplier, who has his own page.
export const portalSuppliersTable = pgTable("portal_suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  what: text("what").notNull().default(""), // what they do
  contactName: text("contact_name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
  supplierId: uuid("supplier_id").references(() => portalSuppliersTable.id, { onDelete: "set null" }), // who we called about it
  statusNote: text("status_note").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const portalItemFollowsTable = pgTable("portal_item_follows", {
  itemId: uuid("item_id").notNull().references(() => portalItemsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => portalClientsTable.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.itemId, t.userId] })]);

// Access tags. The supplier (Ricardo) is told about changes in batches; this table is the source of truth.
// "pending" is not stored: a tag shows as pending while it has an unfinished change line.
export const portalTagsTable = pgTable("portal_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: text("number").notNull().unique(),
  clientId: uuid("client_id").references(() => portalClientsTable.id, { onDelete: "set null" }), // current owner
  holderName: text("holder_name").notNull().default(""), // the name registered at the supplier (can lag behind until a change is done)
  status: text("status").notNull().default("active"), // "active" | "spare" | "lost" | "blocked"
  accessLevel: text("access_level").notNull().default("user"), // level in the supplier's system: "user" | "administrator" | "service"
  companyId: uuid("company_id").references(() => portalCompaniesTable.id, { onDelete: "set null" }),
  note: text("note").notNull().default(""),
  // 4-digit door code: encrypted (so the owner can be shown it) + a fingerprint (so two tags can never share one).
  codeEnc: text("code_enc"),
  codeFp: text("code_fp").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A batch groups several changes into one request. Only one batch is open at a time; it stays open until an admin
// sends it. Sending creates a secret link for the supplier; only a hash of the link is stored.
export const portalTagBatchesTable = pgTable("portal_tag_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: text("status").notNull().default("open"), // "open" | "sent" | "done"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => portalClientsTable.id, { onDelete: "set null" }),
  sentAt: timestamp("sent_at"),
  sentBy: uuid("sent_by").references(() => portalClientsTable.id, { onDelete: "set null" }),
  linkHash: text("link_hash").unique(),
  linkExpiresAt: timestamp("link_expires_at"),
  revokedAt: timestamp("revoked_at"),
}, (t) => [uniqueIndex("portal_tag_batches_one_open").on(t.status).where(sql`${t.status} = 'open'`)]);

export const portalTagChangesTable = pgTable("portal_tag_changes", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id").notNull().references(() => portalTagBatchesTable.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => portalTagsTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // "assign" | "reassign" | "rename" | "lost" | "return"
  fromUserId: uuid("from_user_id").references(() => portalClientsTable.id, { onDelete: "set null" }),
  toUserId: uuid("to_user_id").references(() => portalClientsTable.id, { onDelete: "set null" }),
  fromName: text("from_name").notNull().default(""),
  toName: text("to_name").notNull().default(""),
  note: text("note").notNull().default(""),
  status: text("status").notNull().default("pending"), // "pending" | "done" | "outdated" | "removed"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => portalClientsTable.id, { onDelete: "set null" }),
  doneAt: timestamp("done_at"),
  doneBy: text("done_by"), // "Ricardo" or an admin's name
  doneIp: text("done_ip"),
  // The tag as it was before the change was applied, so an admin can undo a mistaken "Done".
  prevUserId: uuid("prev_user_id"),
  prevStatus: text("prev_status"),
  prevHolderName: text("prev_holder_name"),
});

export const portalTagLogTable = pgTable("portal_tag_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  tagId: uuid("tag_id").references(() => portalTagsTable.id, { onDelete: "set null" }),
  tagNumber: text("tag_number").notNull(),
  event: text("event").notNull(),
  detail: text("detail").notNull().default(""),
  actor: text("actor").notNull(),
  bySupplier: boolean("by_supplier").notNull().default(false),
  ip: text("ip"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// When each admin last looked at the supplier's activity (drives the in-app notification).
export const portalAdminSeenTable = pgTable("portal_admin_seen", {
  adminId: uuid("admin_id").primaryKey().references(() => portalClientsTable.id, { onDelete: "cascade" }),
  seenAt: timestamp("seen_at").notNull().defaultNow(),
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
