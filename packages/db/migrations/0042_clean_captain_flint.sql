CREATE TABLE `ingredient` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`unit` text DEFAULT 'u' NOT NULL,
	`cost_per_unit_cents` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingredient_name_per_org_uq` ON `ingredient` (`organization_id`,`name`);--> statement-breakpoint
CREATE TABLE `variant_ingredient` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`visible_to_customer` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variant`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredient`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `variant_ingredient_variant_idx` ON `variant_ingredient` (`variant_id`);