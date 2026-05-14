CREATE TABLE IF NOT EXISTS "push_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_token" text NOT NULL,
	"platform" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"data" jsonb,
	"status" text DEFAULT 'sent' NOT NULL,
	"provider_message_id" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"platform" text NOT NULL,
	"token" text NOT NULL,
	"device_label" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "push_token" ADD CONSTRAINT "push_token_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "push_token" ADD CONSTRAINT "push_token_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_outbox_device_token_sent_at_idx" ON "push_outbox" USING btree ("device_token","sent_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_outbox_sent_at_idx" ON "push_outbox" USING btree ("sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "push_token_customer_org_token_uq" ON "push_token" USING btree ("customer_id","organization_id","token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_token_customer_idx" ON "push_token" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_token_org_platform_idx" ON "push_token" USING btree ("organization_id","platform");