CREATE TABLE `shortlink` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`target_url` text NOT NULL,
	`organization_id` text NOT NULL,
	`click_count` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by_user_id` text,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shortlink_slug_uq` ON `shortlink` (`slug`);--> statement-breakpoint
CREATE INDEX `shortlink_org_target_idx` ON `shortlink` (`organization_id`,`target_url`);--> statement-breakpoint
CREATE INDEX `shortlink_org_created_idx` ON `shortlink` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `shortlink_click` (
	`id` text PRIMARY KEY NOT NULL,
	`shortlink_id` text NOT NULL,
	`clicked_at` integer NOT NULL,
	`country` text,
	`city` text,
	`user_agent` text,
	`referer` text,
	FOREIGN KEY (`shortlink_id`) REFERENCES `shortlink`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shortlink_click_link_clicked_idx` ON `shortlink_click` (`shortlink_id`,`clicked_at`);