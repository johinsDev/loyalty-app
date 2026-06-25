CREATE TABLE `promo_redemption` (
	`id` text PRIMARY KEY NOT NULL,
	`promo_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`purchase_id` text NOT NULL,
	`discount_cents` integer NOT NULL,
	`currency` text DEFAULT 'COP' NOT NULL,
	`applied_at` integer NOT NULL,
	FOREIGN KEY (`promo_id`) REFERENCES `promo`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchase`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `promo_redemption_promo_idx` ON `promo_redemption` (`promo_id`);--> statement-breakpoint
CREATE INDEX `promo_redemption_promo_customer_idx` ON `promo_redemption` (`promo_id`,`customer_id`);--> statement-breakpoint
CREATE TABLE `purchase_item` (
	`id` text PRIMARY KEY NOT NULL,
	`purchase_id` text NOT NULL,
	`product_id` text NOT NULL,
	`variant_id` text,
	`modifier_option_ids` text,
	`qty` integer DEFAULT 1 NOT NULL,
	`unit_amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'COP' NOT NULL,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchase`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `purchase_item_purchase_idx` ON `purchase_item` (`purchase_id`);--> statement-breakpoint
CREATE TABLE `promo_notification` (
	`id` text PRIMARY KEY NOT NULL,
	`promo_id` text NOT NULL,
	`audience_type` text NOT NULL,
	`audience_value` text,
	`channels` text NOT NULL,
	`scheduled_at` integer,
	`repeat` text DEFAULT 'none' NOT NULL,
	`run_id` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`promo_id`) REFERENCES `promo`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `promo_notification_promo_idx` ON `promo_notification` (`promo_id`);--> statement-breakpoint
CREATE TABLE `promo_translation` (
	`id` text PRIMARY KEY NOT NULL,
	`promo_id` text NOT NULL,
	`locale` text NOT NULL,
	`name` text NOT NULL,
	`short_description` text,
	`long_description` text,
	`badge_label` text,
	FOREIGN KEY (`promo_id`) REFERENCES `promo`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `promo_translation_uq` ON `promo_translation` (`promo_id`,`locale`);--> statement-breakpoint
ALTER TABLE `purchase` ADD `subtotal_cents` integer;--> statement-breakpoint
ALTER TABLE `purchase` ADD `discount_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase` ADD `currency` text DEFAULT 'COP' NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase` ADD `applied_promo_id` text REFERENCES promo(id);--> statement-breakpoint
ALTER TABLE `promo` ADD `slug` text;--> statement-breakpoint
ALTER TABLE `promo` ADD `type` text;--> statement-breakpoint
ALTER TABLE `promo` ADD `benefit` text;--> statement-breakpoint
ALTER TABLE `promo` ADD `scope_kind` text;--> statement-breakpoint
ALTER TABLE `promo` ADD `scope` text;--> statement-breakpoint
ALTER TABLE `promo` ADD `conditions` text;--> statement-breakpoint
ALTER TABLE `promo` ADD `audience_type` text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE `promo` ADD `tier_key` text;--> statement-breakpoint
ALTER TABLE `promo` ADD `audience_customer_ids` text;--> statement-breakpoint
ALTER TABLE `promo` ADD `stackable` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `promo` ADD `short_description` text;--> statement-breakpoint
ALTER TABLE `promo` ADD `long_description` text;--> statement-breakpoint
ALTER TABLE `promo` ADD `badge_label` text;--> statement-breakpoint
ALTER TABLE `promo` ADD `icon` text;--> statement-breakpoint
ALTER TABLE `promo` ADD `background_css` text;--> statement-breakpoint
ALTER TABLE `promo` ADD `main_image_url` text;--> statement-breakpoint
ALTER TABLE `promo` ADD `category` text;--> statement-breakpoint
ALTER TABLE `promo` ADD `featured` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `promo` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `promo` ADD `seo_title` text;--> statement-breakpoint
ALTER TABLE `promo` ADD `seo_description` text;--> statement-breakpoint
ALTER TABLE `promo` ADD `og_image_url` text;--> statement-breakpoint
CREATE UNIQUE INDEX `promo_slug_per_org_uq` ON `promo` (`organization_id`,`slug`);