ALTER TABLE `campaign` ADD `link_url` text;--> statement-breakpoint
ALTER TABLE `shortlink` ADD `campaign_id` text;--> statement-breakpoint
ALTER TABLE `shortlink` ADD `customer_id` text;--> statement-breakpoint
CREATE INDEX `shortlink_campaign_idx` ON `shortlink` (`campaign_id`);