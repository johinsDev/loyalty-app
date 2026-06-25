CREATE TABLE `banner_translation` (
	`id` text PRIMARY KEY NOT NULL,
	`banner_id` text NOT NULL,
	`locale` text NOT NULL,
	`name` text NOT NULL,
	`short_description` text,
	`long_description` text,
	FOREIGN KEY (`banner_id`) REFERENCES `banner`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `banner_translation_uq` ON `banner_translation` (`banner_id`,`locale`);--> statement-breakpoint
CREATE TABLE `organization_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`default_locale` text DEFAULT 'es' NOT NULL,
	`enabled_locales` text NOT NULL,
	`default_currency` text DEFAULT 'COP' NOT NULL,
	`enabled_currencies` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_settings_organization_id_unique` ON `organization_settings` (`organization_id`);--> statement-breakpoint
CREATE TABLE `category_translation` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`locale` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_translation_uq` ON `category_translation` (`category_id`,`locale`);--> statement-breakpoint
CREATE TABLE `modifier_option_price` (
	`id` text PRIMARY KEY NOT NULL,
	`modifier_option_id` text NOT NULL,
	`currency` text NOT NULL,
	`amount_cents` integer NOT NULL,
	FOREIGN KEY (`modifier_option_id`) REFERENCES `modifier_option`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `modifier_option_price_uq` ON `modifier_option_price` (`modifier_option_id`,`currency`);--> statement-breakpoint
CREATE TABLE `product_price` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`currency` text NOT NULL,
	`amount_cents` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_price_uq` ON `product_price` (`product_id`,`currency`);--> statement-breakpoint
CREATE TABLE `product_translation` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`locale` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_translation_uq` ON `product_translation` (`product_id`,`locale`);--> statement-breakpoint
CREATE TABLE `product_variant_price` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`currency` text NOT NULL,
	`amount_cents` integer NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variant`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_variant_price_uq` ON `product_variant_price` (`variant_id`,`currency`);