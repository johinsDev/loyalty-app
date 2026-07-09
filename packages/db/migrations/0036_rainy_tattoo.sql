ALTER TABLE `purchase` ADD `voided_at` integer;--> statement-breakpoint
ALTER TABLE `purchase` ADD `void_reason` text;--> statement-breakpoint
ALTER TABLE `purchase` ADD `voided_by_user_id` text REFERENCES user(id);