CREATE TABLE `banner` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`short_description` text,
	`long_description` text,
	`background_css` text,
	`main_image_url` text,
	`main_image_blur` text,
	`cta_label` text,
	`cta_href` text,
	`cta_kind` text,
	`display_from` integer,
	`display_until` integer,
	`seo_title` text,
	`seo_description` text,
	`og_image_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `banner_slug_per_org_uq` ON `banner` (`organization_id`,`slug`);--> statement-breakpoint
CREATE INDEX `banner_org_sort_idx` ON `banner` (`organization_id`,`status`,`sort_order`,`id`);--> statement-breakpoint
CREATE TABLE `banner_notification` (
	`id` text PRIMARY KEY NOT NULL,
	`banner_id` text NOT NULL,
	`audience_type` text NOT NULL,
	`audience_value` text,
	`channels` text NOT NULL,
	`scheduled_at` integer,
	`run_id` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`banner_id`) REFERENCES `banner`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `banner_notification_banner_idx` ON `banner_notification` (`banner_id`);