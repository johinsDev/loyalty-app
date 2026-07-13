ALTER TABLE `organization_settings` ADD `loyalty_mode` text DEFAULT 'both' NOT NULL;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `points_rates` text;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `points_card_template` text DEFAULT 'classic' NOT NULL;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `tier_grace_until` integer;