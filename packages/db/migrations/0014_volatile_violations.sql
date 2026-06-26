ALTER TABLE `redemption` ADD `purchase_id` text REFERENCES purchase(id);--> statement-breakpoint
CREATE INDEX `redemption_purchase_idx` ON `redemption` (`purchase_id`);