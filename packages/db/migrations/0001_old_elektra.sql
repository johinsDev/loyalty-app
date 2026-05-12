CREATE TABLE IF NOT EXISTS "sms_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to" text NOT NULL,
	"from" text,
	"content" text NOT NULL,
	"encoding" text DEFAULT 'GSM-7' NOT NULL,
	"segments" integer DEFAULT 1 NOT NULL,
	"characters" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"provider_message_id" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sms_outbox_to_sent_at_idx" ON "sms_outbox" USING btree ("to","sent_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sms_outbox_sent_at_idx" ON "sms_outbox" USING btree ("sent_at");