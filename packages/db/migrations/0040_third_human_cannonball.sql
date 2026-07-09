ALTER TABLE `product` ADD `gender` text;--> statement-breakpoint
ALTER TABLE `product` ADD `age_range` text;--> statement-breakpoint
ALTER TABLE `product` ADD `mpn` text;--> statement-breakpoint
ALTER TABLE `product` ADD `stock_mode` text DEFAULT 'infinite' NOT NULL;--> statement-breakpoint
ALTER TABLE `product` ADD `stock_qty` integer;--> statement-breakpoint
ALTER TABLE `product` ADD `product_type` text DEFAULT 'physical' NOT NULL;