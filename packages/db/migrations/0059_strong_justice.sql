CREATE TABLE `purchase_item_addon` (
	`id` text PRIMARY KEY NOT NULL,
	`purchase_item_id` text NOT NULL,
	`addon_id` text,
	`name` text NOT NULL,
	`price_cents` integer DEFAULT 0 NOT NULL,
	`cost_cents` integer DEFAULT 0 NOT NULL,
	`qty` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`purchase_item_id`) REFERENCES `purchase_item`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `purchase_item_addon_item_idx` ON `purchase_item_addon` (`purchase_item_id`);--> statement-breakpoint
CREATE TABLE `catalog_category` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_category_name_per_org_kind_uq` ON `catalog_category` (`organization_id`,`kind`,`name`);--> statement-breakpoint
ALTER TABLE `addon` ADD `ingredient_qty` real;--> statement-breakpoint
ALTER TABLE `addon` ADD `category_id` text REFERENCES catalog_category(id);--> statement-breakpoint
CREATE INDEX `addon_category_idx` ON `addon` (`category_id`);--> statement-breakpoint
ALTER TABLE `addon_group` ADD `source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `addon_group` ADD `category_id` text REFERENCES catalog_category(id);--> statement-breakpoint
CREATE INDEX `addon_group_product_idx` ON `addon_group` (`product_id`);--> statement-breakpoint
ALTER TABLE `ingredient` ADD `category_id` text REFERENCES catalog_category(id);--> statement-breakpoint
ALTER TABLE `ingredient` ADD `archived_at` integer;--> statement-breakpoint
CREATE INDEX `variant_ingredient_ingredient_idx` ON `variant_ingredient` (`ingredient_id`);