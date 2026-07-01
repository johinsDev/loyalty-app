PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_points_transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`type` text NOT NULL,
	`points` integer NOT NULL,
	`reason` text,
	`purchase_id` text,
	`added_by_user_id` text,
	`store_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchase`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`added_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `store`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_points_transaction`("id", "customer_id", "organization_id", "type", "points", "reason", "purchase_id", "added_by_user_id", "store_id", "created_at") SELECT "id", "customer_id", "organization_id", "type", "points", "reason", "purchase_id", "added_by_user_id", "store_id", "created_at" FROM `points_transaction`;--> statement-breakpoint
DROP TABLE `points_transaction`;--> statement-breakpoint
ALTER TABLE `__new_points_transaction` RENAME TO `points_transaction`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `points_tx_customer_idx` ON `points_transaction` (`organization_id`,`customer_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `points_tx_purchase_uq` ON `points_transaction` (`organization_id`,`purchase_id`);--> statement-breakpoint
CREATE TABLE `__new_purchase` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`wallet_id` text NOT NULL,
	`added_by_user_id` text NOT NULL,
	`store_id` text NOT NULL,
	`price_cents` integer NOT NULL,
	`subtotal_cents` integer,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'COP' NOT NULL,
	`applied_promo_id` text,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`wallet_id`) REFERENCES `loyalty_card`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `store`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`applied_promo_id`) REFERENCES `promo`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_purchase`("id", "customer_id", "organization_id", "wallet_id", "added_by_user_id", "store_id", "price_cents", "subtotal_cents", "discount_cents", "currency", "applied_promo_id", "idempotency_key", "created_at") SELECT "id", "customer_id", "organization_id", "wallet_id", "added_by_user_id", "store_id", "price_cents", "subtotal_cents", "discount_cents", "currency", "applied_promo_id", "idempotency_key", "created_at" FROM `purchase`;--> statement-breakpoint
DROP TABLE `purchase`;--> statement-breakpoint
ALTER TABLE `__new_purchase` RENAME TO `purchase`;--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_idempotency_per_org_uq` ON `purchase` (`organization_id`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `__new_stamp` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`purchase_id` text NOT NULL,
	`added_by_user_id` text NOT NULL,
	`store_id` text NOT NULL,
	`amount` integer DEFAULT 1 NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `loyalty_card`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchase`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `store`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_stamp`("id", "card_id", "purchase_id", "added_by_user_id", "store_id", "amount", "note", "created_at") SELECT "id", "card_id", "purchase_id", "added_by_user_id", "store_id", "amount", "note", "created_at" FROM `stamp`;--> statement-breakpoint
DROP TABLE `stamp`;--> statement-breakpoint
ALTER TABLE `__new_stamp` RENAME TO `stamp`;