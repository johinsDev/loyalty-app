ALTER TABLE `customer` ADD `nickname` text;--> statement-breakpoint
ALTER TABLE `customer` ADD `avatar_preset` text;--> statement-breakpoint
ALTER TABLE `customer` ADD `avatar_url` text;--> statement-breakpoint
ALTER TABLE `customer` ADD `avatar_thumbhash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `customer_nickname_per_org_uq` ON `customer` (`organization_id`,`nickname`);