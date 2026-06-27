ALTER TABLE `organization_settings` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `default_hours` text;--> statement-breakpoint
ALTER TABLE `store` ADD `logo` text;--> statement-breakpoint
ALTER TABLE `store` ADD `social_links` text;--> statement-breakpoint
ALTER TABLE `store` ADD `status` text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE `store` ADD `deleted_at` integer;