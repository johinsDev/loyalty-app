CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `invitation` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`inviter_id` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inviter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `member` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `organization` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo` text,
	`created_at` integer NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_slug_unique` ON `organization` (`slug`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`active_organization_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text,
	`email_verified` integer DEFAULT false NOT NULL,
	`phone_number` text,
	`phone_number_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_phone_number_unique` ON `user` (`phone_number`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `email_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`to` text NOT NULL,
	`from` text,
	`reply_to` text,
	`cc` text,
	`bcc` text,
	`subject` text NOT NULL,
	`html` text,
	`text` text,
	`status` text DEFAULT 'sent' NOT NULL,
	`provider_message_id` text,
	`sent_at` integer NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `email_outbox_to_sent_at_idx` ON `email_outbox` (`to`,`sent_at`);--> statement-breakpoint
CREATE INDEX `email_outbox_sent_at_idx` ON `email_outbox` (`sent_at`);--> statement-breakpoint
CREATE TABLE `customer` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_phone_per_org_uq` ON `customer` (`organization_id`,`phone`);--> statement-breakpoint
CREATE TABLE `loyalty_card` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`current_stamps` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `redemption` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`reward_id` text NOT NULL,
	`redeemed_by_user_id` text NOT NULL,
	`stamps_spent` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `loyalty_card`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reward_id`) REFERENCES `reward`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`redeemed_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reward` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`stamps_required` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `stamp` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`added_by_user_id` text NOT NULL,
	`amount` integer DEFAULT 1 NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `loyalty_card`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `push_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`device_token` text NOT NULL,
	`platform` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`data` text,
	`status` text DEFAULT 'sent' NOT NULL,
	`provider_message_id` text,
	`sent_at` integer NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `push_outbox_device_token_sent_at_idx` ON `push_outbox` (`device_token`,`sent_at`);--> statement-breakpoint
CREATE INDEX `push_outbox_sent_at_idx` ON `push_outbox` (`sent_at`);--> statement-breakpoint
CREATE TABLE `push_token` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`platform` text NOT NULL,
	`token` text NOT NULL,
	`device_label` text,
	`is_active` integer DEFAULT true NOT NULL,
	`last_used_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_token_customer_org_token_uq` ON `push_token` (`customer_id`,`organization_id`,`token`);--> statement-breakpoint
CREATE INDEX `push_token_customer_idx` ON `push_token` (`customer_id`);--> statement-breakpoint
CREATE INDEX `push_token_org_platform_idx` ON `push_token` (`organization_id`,`platform`);--> statement-breakpoint
CREATE TABLE `sms_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`to` text NOT NULL,
	`from` text,
	`content` text NOT NULL,
	`encoding` text DEFAULT 'GSM-7' NOT NULL,
	`segments` integer DEFAULT 1 NOT NULL,
	`characters` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'sent' NOT NULL,
	`provider_message_id` text,
	`sent_at` integer NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `sms_outbox_to_sent_at_idx` ON `sms_outbox` (`to`,`sent_at`);--> statement-breakpoint
CREATE INDEX `sms_outbox_sent_at_idx` ON `sms_outbox` (`sent_at`);--> statement-breakpoint
CREATE TABLE `whatsapp_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`to` text NOT NULL,
	`from` text,
	`content` text NOT NULL,
	`content_sid` text,
	`content_variables` text,
	`media_url` text,
	`status` text DEFAULT 'sent' NOT NULL,
	`provider_message_id` text,
	`sent_at` integer NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `whatsapp_outbox_to_sent_at_idx` ON `whatsapp_outbox` (`to`,`sent_at`);--> statement-breakpoint
CREATE INDEX `whatsapp_outbox_sent_at_idx` ON `whatsapp_outbox` (`sent_at`);