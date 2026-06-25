PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_redemption` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text,
	`organization_id` text,
	`card_id` text,
	`reward_id` text NOT NULL,
	`redeemed_by_user_id` text NOT NULL,
	`currency` text DEFAULT 'stamps' NOT NULL,
	`stamps_spent` integer DEFAULT 0 NOT NULL,
	`points_spent` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`) REFERENCES `loyalty_card`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reward_id`) REFERENCES `reward`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`redeemed_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_redemption`("id", "customer_id", "organization_id", "card_id", "reward_id", "redeemed_by_user_id", "currency", "stamps_spent", "points_spent", "created_at") SELECT "id", "customer_id", "organization_id", "card_id", "reward_id", "redeemed_by_user_id", "currency", "stamps_spent", "points_spent", "created_at" FROM `redemption`;--> statement-breakpoint
DROP TABLE `redemption`;--> statement-breakpoint
ALTER TABLE `__new_redemption` RENAME TO `redemption`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `redemption_customer_idx` ON `redemption` (`organization_id`,`customer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `redemption_customer_reward_idx` ON `redemption` (`customer_id`,`reward_id`);