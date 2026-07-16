ALTER TABLE `loyalty_card` ADD `pending_purchases` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `stamps_card_reward_id` text;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `purchases_per_stamp` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `stamp_min_amount` text;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `stamp_category_ids` text;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `stamps_card_template` text DEFAULT 'classic' NOT NULL;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `stamp_style` text;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `stamps_card_copy` text;