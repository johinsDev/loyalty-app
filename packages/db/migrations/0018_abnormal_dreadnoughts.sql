CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`actor_user_id` text,
	`target_user_id` text,
	`type` text NOT NULL,
	`metadata` text,
	`ip` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_log_target_idx` ON `audit_log` (`organization_id`,`target_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_log_actor_idx` ON `audit_log` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `store_staff` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`store_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`store_id`) REFERENCES `store`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_staff_user_store_uq` ON `store_staff` (`user_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `store_staff_org_user_idx` ON `store_staff` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `store_staff_store_idx` ON `store_staff` (`store_id`);--> statement-breakpoint
ALTER TABLE `invitation` ADD `assigned_store_ids` text;--> statement-breakpoint
ALTER TABLE `member` ADD `rating` integer;--> statement-breakpoint
ALTER TABLE `member` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `member` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `session` ADD `impersonated_by` text;--> statement-breakpoint
ALTER TABLE `user` ADD `role` text;--> statement-breakpoint
ALTER TABLE `user` ADD `banned` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_reason` text;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_expires` integer;--> statement-breakpoint
ALTER TABLE `points_transaction` ADD `store_id` text REFERENCES store(id);--> statement-breakpoint
ALTER TABLE `purchase` ADD `store_id` text REFERENCES store(id);--> statement-breakpoint
ALTER TABLE `redemption` ADD `store_id` text REFERENCES store(id);--> statement-breakpoint
ALTER TABLE `stamp` ADD `store_id` text REFERENCES store(id);