CREATE TABLE `reward_translation` (
	`id` text PRIMARY KEY NOT NULL,
	`reward_id` text NOT NULL,
	`locale` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	FOREIGN KEY (`reward_id`) REFERENCES `reward`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reward_translation_uq` ON `reward_translation` (`reward_id`,`locale`);--> statement-breakpoint
ALTER TABLE `redemption` ADD `discount_cents` integer;--> statement-breakpoint
ALTER TABLE `reward` ADD `created_by_user_id` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `reward` ADD `status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `reward` ADD `type` text;--> statement-breakpoint
ALTER TABLE `reward` ADD `benefit` text;--> statement-breakpoint
ALTER TABLE `reward` ADD `fulfillment_note` text;--> statement-breakpoint
ALTER TABLE `reward` ADD `background_css` text;--> statement-breakpoint
ALTER TABLE `reward` ADD `icon` text;--> statement-breakpoint
ALTER TABLE `reward` ADD `published_at` integer;--> statement-breakpoint
CREATE INDEX `reward_org_status_idx` ON `reward` (`organization_id`,`status`);