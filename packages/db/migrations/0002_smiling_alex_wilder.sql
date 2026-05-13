CREATE TABLE IF NOT EXISTS "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to" text NOT NULL,
	"from" text,
	"reply_to" text,
	"cc" text,
	"bcc" text,
	"subject" text NOT NULL,
	"html" text,
	"text" text,
	"status" text DEFAULT 'sent' NOT NULL,
	"provider_message_id" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_outbox_to_sent_at_idx" ON "email_outbox" USING btree ("to","sent_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_outbox_sent_at_idx" ON "email_outbox" USING btree ("sent_at");