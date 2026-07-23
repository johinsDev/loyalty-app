CREATE TABLE `addon` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price_delta_cents` integer DEFAULT 0 NOT NULL,
	`cost_cents` integer DEFAULT 0 NOT NULL,
	`ingredient_id` text,
	`sku` text,
	`stock_mode` text DEFAULT 'infinite' NOT NULL,
	`stock_qty` integer,
	`currency` text DEFAULT 'COP' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredient`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `addon_name_per_org_uq` ON `addon` (`organization_id`,`name`);--> statement-breakpoint
CREATE TABLE `addon_group` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`selection_type` text DEFAULT 'multi' NOT NULL,
	`min_select` integer DEFAULT 0 NOT NULL,
	`max_select` integer,
	`required` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `addon_group_item` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`addon_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `addon_group`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`addon_id`) REFERENCES `addon`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `addon_group_item_uq` ON `addon_group_item` (`group_id`,`addon_id`);--> statement-breakpoint
CREATE TABLE `addon_price` (
	`id` text PRIMARY KEY NOT NULL,
	`addon_id` text NOT NULL,
	`currency` text NOT NULL,
	`amount_cents` integer NOT NULL,
	FOREIGN KEY (`addon_id`) REFERENCES `addon`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `addon_price_uq` ON `addon_price` (`addon_id`,`currency`);--> statement-breakpoint
ALTER TABLE `variant_ingredient` ADD `removable` integer DEFAULT false NOT NULL;