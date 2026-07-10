PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_stamp` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`purchase_id` text,
	`added_by_user_id` text NOT NULL,
	`store_id` text,
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
ALTER TABLE `__new_stamp` RENAME TO `stamp`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `customer` ADD `birthday` integer;