CREATE TABLE `store` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text,
	`address` text,
	`lat` real,
	`lng` real,
	`place_id` text,
	`phone` text,
	`hours` text,
	`timezone` text DEFAULT 'America/Bogota' NOT NULL,
	`map_static_url` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `store_org_primary_idx` ON `store` (`organization_id`,`is_primary`);--> statement-breakpoint
CREATE INDEX `store_org_published_idx` ON `store` (`organization_id`,`is_published`);--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `description` text;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `brand_color` text;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `social_links` text;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `terms_pdf_url` text;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `loyalty_scope` text DEFAULT 'org' NOT NULL;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `seo_title` text;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `seo_description` text;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `seo_keywords` text;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `og_image_url` text;