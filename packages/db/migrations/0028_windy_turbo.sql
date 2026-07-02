ALTER TABLE `campaign` ADD `mode` text DEFAULT 'once' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaign` ADD `cooldown_days` integer;--> statement-breakpoint
ALTER TABLE `campaign` ADD `ends_at` integer;--> statement-breakpoint
ALTER TABLE `campaign` ADD `activated_at` integer;--> statement-breakpoint
ALTER TABLE `campaign` ADD `last_pulse_at` integer;