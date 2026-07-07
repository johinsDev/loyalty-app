CREATE TABLE `notification_config` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`notification_key` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`channels` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_config_org_key_uq` ON `notification_config` (`organization_id`,`notification_key`);