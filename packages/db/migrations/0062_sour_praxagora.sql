ALTER TABLE `category` ADD `description` text;--> statement-breakpoint
ALTER TABLE `category` ADD `archived_at` integer;--> statement-breakpoint
ALTER TABLE `category` ADD `archived_by_parent` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `category_org_parent_sort_idx` ON `category` (`organization_id`,`parent_id`,`sort_order`);--> statement-breakpoint
ALTER TABLE `category` ALTER COLUMN "parent_id" TO "parent_id" text REFERENCES category(id) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `category_translation` ADD `description` text;--> statement-breakpoint
ALTER TABLE `product_category` ADD `is_primary` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `product_primary_category_uq` ON `product_category` (`product_id`) WHERE "product_category"."is_primary" = 1;--> statement-breakpoint
CREATE INDEX `purchase_item_product_idx` ON `purchase_item` (`product_id`);