CREATE TABLE `admin_notification` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`store_id` text,
	`type` text NOT NULL,
	`severity` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`data` text,
	`entity_type` text,
	`entity_id` text,
	`read_at` integer,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`store_id`) REFERENCES `store`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `admin_notification_inbox_idx` ON `admin_notification` (`user_id`,`organization_id`,`archived_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_notification_unread_idx` ON `admin_notification` (`user_id`,`organization_id`,`read_at`);