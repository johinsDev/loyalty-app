CREATE TABLE `purchase` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`wallet_id` text NOT NULL,
	`added_by_user_id` text NOT NULL,
	`price_cents` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`wallet_id`) REFERENCES `loyalty_card`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_idempotency_per_org_uq` ON `purchase` (`organization_id`,`idempotency_key`);--> statement-breakpoint
ALTER TABLE `loyalty_card` ADD `sequence` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `loyalty_card` ADD `completed_at` integer;--> statement-breakpoint
ALTER TABLE `loyalty_card` ADD `claimed_at` integer;--> statement-breakpoint
ALTER TABLE `loyalty_card` ADD `claimed_by_user_id` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `stamp` ADD `purchase_id` text NOT NULL REFERENCES purchase(id);