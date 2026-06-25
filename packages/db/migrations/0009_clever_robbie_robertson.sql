CREATE TABLE `reward_availability` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`reward_id` text NOT NULL,
	`ready_at` integer NOT NULL,
	`last_stage` text DEFAULT 'immediate' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reward_id`) REFERENCES `reward`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reward_availability_customer_reward_uq` ON `reward_availability` (`customer_id`,`reward_id`);--> statement-breakpoint
CREATE INDEX `reward_availability_ready_idx` ON `reward_availability` (`ready_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_redemption` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`card_id` text,
	`reward_id` text NOT NULL,
	`redeemed_by_user_id` text NOT NULL,
	`currency` text NOT NULL,
	`stamps_spent` integer DEFAULT 0 NOT NULL,
	`points_spent` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`) REFERENCES `loyalty_card`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reward_id`) REFERENCES `reward`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`redeemed_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_redemption`("id", "customer_id", "organization_id", "card_id", "reward_id", "redeemed_by_user_id", "currency", "stamps_spent", "points_spent", "created_at") SELECT "id", "customer_id", "organization_id", "card_id", "reward_id", "redeemed_by_user_id", "currency", "stamps_spent", "points_spent", "created_at" FROM `redemption`;--> statement-breakpoint
DROP TABLE `redemption`;--> statement-breakpoint
ALTER TABLE `__new_redemption` RENAME TO `redemption`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `redemption_customer_idx` ON `redemption` (`organization_id`,`customer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `redemption_customer_reward_idx` ON `redemption` (`customer_id`,`reward_id`);--> statement-breakpoint
DROP INDEX IF EXISTS "organization_slug_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "session_token_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "user_phone_number_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "banner_slug_per_org_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "banner_org_sort_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "banner_notification_banner_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "email_outbox_to_sent_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "email_outbox_sent_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "customer_phone_per_org_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "points_account_customer_id_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "points_tx_customer_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "points_tx_purchase_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "purchase_idempotency_per_org_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "redemption_customer_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "redemption_customer_reward_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "reward_availability_customer_reward_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "reward_availability_ready_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "notification_feed_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "notification_created_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "notification_preference_customer_org_channel_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "category_slug_per_org_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "product_slug_per_org_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "product_org_sort_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "product_category_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "product_favorite_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "product_variant_value_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "section_product_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "promo_org_status_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "push_outbox_device_token_sent_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "push_outbox_sent_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "push_token_customer_org_token_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "push_token_customer_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "push_token_org_platform_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "shortlink_slug_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "shortlink_org_target_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "shortlink_org_created_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "shortlink_click_link_clicked_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "sms_outbox_to_sent_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "sms_outbox_sent_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "whatsapp_outbox_to_sent_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "whatsapp_outbox_sent_at_idx";--> statement-breakpoint
ALTER TABLE `reward` ALTER COLUMN "stamps_required" TO "stamps_required" integer;--> statement-breakpoint
CREATE UNIQUE INDEX `organization_slug_unique` ON `organization` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_phone_number_unique` ON `user` (`phone_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `banner_slug_per_org_uq` ON `banner` (`organization_id`,`slug`);--> statement-breakpoint
CREATE INDEX `banner_org_sort_idx` ON `banner` (`organization_id`,`status`,`sort_order`,`id`);--> statement-breakpoint
CREATE INDEX `banner_notification_banner_idx` ON `banner_notification` (`banner_id`);--> statement-breakpoint
CREATE INDEX `email_outbox_to_sent_at_idx` ON `email_outbox` (`to`,`sent_at`);--> statement-breakpoint
CREATE INDEX `email_outbox_sent_at_idx` ON `email_outbox` (`sent_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `customer_phone_per_org_uq` ON `customer` (`organization_id`,`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `points_account_customer_id_unique` ON `points_account` (`customer_id`);--> statement-breakpoint
CREATE INDEX `points_tx_customer_idx` ON `points_transaction` (`organization_id`,`customer_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `points_tx_purchase_uq` ON `points_transaction` (`organization_id`,`purchase_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_idempotency_per_org_uq` ON `purchase` (`organization_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `notification_feed_idx` ON `notification` (`customer_id`,`organization_id`,`read_at`);--> statement-breakpoint
CREATE INDEX `notification_created_at_idx` ON `notification` (`customer_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `notification_preference_customer_org_channel_uq` ON `notification_preference` (`customer_id`,`organization_id`,`channel`);--> statement-breakpoint
CREATE UNIQUE INDEX `category_slug_per_org_uq` ON `category` (`organization_id`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_slug_per_org_uq` ON `product` (`organization_id`,`slug`);--> statement-breakpoint
CREATE INDEX `product_org_sort_idx` ON `product` (`organization_id`,`status`,`sort_order`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_category_uq` ON `product_category` (`product_id`,`category_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_favorite_uq` ON `product_favorite` (`customer_id`,`product_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_variant_value_uq` ON `product_variant_value` (`variant_id`,`option_value_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `section_product_uq` ON `section_product` (`section_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `promo_org_status_idx` ON `promo` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `push_outbox_device_token_sent_at_idx` ON `push_outbox` (`device_token`,`sent_at`);--> statement-breakpoint
CREATE INDEX `push_outbox_sent_at_idx` ON `push_outbox` (`sent_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `push_token_customer_org_token_uq` ON `push_token` (`customer_id`,`organization_id`,`token`);--> statement-breakpoint
CREATE INDEX `push_token_customer_idx` ON `push_token` (`customer_id`);--> statement-breakpoint
CREATE INDEX `push_token_org_platform_idx` ON `push_token` (`organization_id`,`platform`);--> statement-breakpoint
CREATE UNIQUE INDEX `shortlink_slug_uq` ON `shortlink` (`slug`);--> statement-breakpoint
CREATE INDEX `shortlink_org_target_idx` ON `shortlink` (`organization_id`,`target_url`);--> statement-breakpoint
CREATE INDEX `shortlink_org_created_idx` ON `shortlink` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `shortlink_click_link_clicked_idx` ON `shortlink_click` (`shortlink_id`,`clicked_at`);--> statement-breakpoint
CREATE INDEX `sms_outbox_to_sent_at_idx` ON `sms_outbox` (`to`,`sent_at`);--> statement-breakpoint
CREATE INDEX `sms_outbox_sent_at_idx` ON `sms_outbox` (`sent_at`);--> statement-breakpoint
CREATE INDEX `whatsapp_outbox_to_sent_at_idx` ON `whatsapp_outbox` (`to`,`sent_at`);--> statement-breakpoint
CREATE INDEX `whatsapp_outbox_sent_at_idx` ON `whatsapp_outbox` (`sent_at`);--> statement-breakpoint
ALTER TABLE `reward` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `reward` ADD `points_cost` integer;--> statement-breakpoint
ALTER TABLE `reward` ADD `cost_mode` text DEFAULT 'or' NOT NULL;--> statement-breakpoint
ALTER TABLE `reward` ADD `allowed_tiers` text;--> statement-breakpoint
ALTER TABLE `reward` ADD `sections` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `reward` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `reward` ADD `limit_per_customer` text DEFAULT 'unlimited' NOT NULL;