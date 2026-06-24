CREATE TABLE `points_account` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`current_tier_key` text,
	`near_notified_tier_key` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `points_account_customer_id_unique` ON `points_account` (`customer_id`);--> statement-breakpoint
CREATE TABLE `points_transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`type` text NOT NULL,
	`points` integer NOT NULL,
	`reason` text,
	`purchase_id` text,
	`added_by_user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchase`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`added_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `points_tx_customer_idx` ON `points_transaction` (`organization_id`,`customer_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `points_tx_purchase_uq` ON `points_transaction` (`organization_id`,`purchase_id`);