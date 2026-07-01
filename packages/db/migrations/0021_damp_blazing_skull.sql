CREATE TABLE `banner_daily_stat` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`banner_id` text NOT NULL,
	`day` text NOT NULL,
	`impressions` integer DEFAULT 0 NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`banner_id`) REFERENCES `banner`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `banner_daily_stat_banner_day_uq` ON `banner_daily_stat` (`banner_id`,`day`);--> statement-breakpoint
CREATE INDEX `banner_daily_stat_org_day_idx` ON `banner_daily_stat` (`organization_id`,`day`);