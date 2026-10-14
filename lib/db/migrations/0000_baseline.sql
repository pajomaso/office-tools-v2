CREATE TABLE "portal_admin_seen" (
	"admin_id" uuid PRIMARY KEY NOT NULL,
	"seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid,
	"kind" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"title" text NOT NULL,
	"booked_for" text,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"company_id" uuid,
	"kind" text DEFAULT 'company' NOT NULL,
	"password_hash" text,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "portal_clients_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "portal_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "portal_companies_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "portal_guide_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" text NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_item_follows" (
	"item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "portal_item_follows_item_id_user_id_pk" PRIMARY KEY("item_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "portal_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"claimed_by" uuid,
	"supplier_id" uuid,
	"status_note" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_login_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"client_id" uuid NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"purpose" text DEFAULT 'login' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp NOT NULL,
	"edited_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_room_photos" (
	"room_id" uuid PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"data" "bytea" NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"seats" integer DEFAULT 4 NOT NULL,
	"color" text DEFAULT '#045CFC' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" uuid NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"what" text DEFAULT '' NOT NULL,
	"contact_name" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_tag_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"sent_at" timestamp,
	"sent_by" uuid,
	"link_hash" text,
	"link_expires_at" timestamp,
	"revoked_at" timestamp,
	CONSTRAINT "portal_tag_batches_link_hash_unique" UNIQUE("link_hash")
);
--> statement-breakpoint
CREATE TABLE "portal_tag_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"from_user_id" uuid,
	"to_user_id" uuid,
	"from_name" text DEFAULT '' NOT NULL,
	"to_name" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"done_at" timestamp,
	"done_by" text,
	"done_ip" text,
	"prev_user_id" uuid,
	"prev_status" text,
	"prev_holder_name" text
);
--> statement-breakpoint
CREATE TABLE "portal_tag_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tag_id" uuid,
	"tag_number" text NOT NULL,
	"event" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"actor" text NOT NULL,
	"by_supplier" boolean DEFAULT false NOT NULL,
	"ip" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"client_id" uuid,
	"holder_name" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"access_level" text DEFAULT 'user' NOT NULL,
	"company_id" uuid,
	"note" text DEFAULT '' NOT NULL,
	"code_enc" text,
	"code_fp" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "portal_tags_number_unique" UNIQUE("number"),
	CONSTRAINT "portal_tags_code_fp_unique" UNIQUE("code_fp")
);
--> statement-breakpoint
ALTER TABLE "portal_admin_seen" ADD CONSTRAINT "portal_admin_seen_admin_id_portal_clients_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."portal_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_blocks" ADD CONSTRAINT "portal_blocks_room_id_portal_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."portal_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_blocks" ADD CONSTRAINT "portal_blocks_created_by_portal_clients_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."portal_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_bookings" ADD CONSTRAINT "portal_bookings_room_id_portal_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."portal_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_bookings" ADD CONSTRAINT "portal_bookings_client_id_portal_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."portal_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_clients" ADD CONSTRAINT "portal_clients_company_id_portal_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."portal_companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_item_follows" ADD CONSTRAINT "portal_item_follows_item_id_portal_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."portal_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_item_follows" ADD CONSTRAINT "portal_item_follows_user_id_portal_clients_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."portal_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_items" ADD CONSTRAINT "portal_items_author_id_portal_clients_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."portal_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_items" ADD CONSTRAINT "portal_items_claimed_by_portal_clients_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."portal_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_items" ADD CONSTRAINT "portal_items_supplier_id_portal_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."portal_suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_login_tokens" ADD CONSTRAINT "portal_login_tokens_client_id_portal_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."portal_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_messages" ADD CONSTRAINT "portal_messages_author_id_portal_clients_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."portal_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_room_photos" ADD CONSTRAINT "portal_room_photos_room_id_portal_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."portal_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_client_id_portal_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."portal_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_tag_batches" ADD CONSTRAINT "portal_tag_batches_created_by_portal_clients_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."portal_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_tag_batches" ADD CONSTRAINT "portal_tag_batches_sent_by_portal_clients_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."portal_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_tag_changes" ADD CONSTRAINT "portal_tag_changes_batch_id_portal_tag_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."portal_tag_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_tag_changes" ADD CONSTRAINT "portal_tag_changes_tag_id_portal_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."portal_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_tag_changes" ADD CONSTRAINT "portal_tag_changes_from_user_id_portal_clients_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."portal_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_tag_changes" ADD CONSTRAINT "portal_tag_changes_to_user_id_portal_clients_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."portal_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_tag_changes" ADD CONSTRAINT "portal_tag_changes_created_by_portal_clients_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."portal_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_tag_log" ADD CONSTRAINT "portal_tag_log_tag_id_portal_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."portal_tags"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_tags" ADD CONSTRAINT "portal_tags_client_id_portal_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."portal_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_tags" ADD CONSTRAINT "portal_tags_company_id_portal_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."portal_companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "portal_tag_batches_one_open" ON "portal_tag_batches" USING btree ("status") WHERE "portal_tag_batches"."status" = 'open';