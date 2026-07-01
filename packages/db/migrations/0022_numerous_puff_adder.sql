CREATE TABLE `campaign` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`type` text DEFAULT 'promotional' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`send_state` text,
	`name` text,
	`objective` text,
	`message` text,
	`offer` text,
	`channel_priority` text,
	`audience_filter` text,
	`scheduled_at` integer,
	`special` integer DEFAULT false NOT NULL,
	`run_id` text,
	`paused_at` integer,
	`sent_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`published_at` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `campaign_org_status_idx` ON `campaign` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `campaign_org_type_idx` ON `campaign` (`organization_id`,`type`);--> statement-breakpoint
CREATE TABLE `campaign_send` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`channel` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`skip_reason` text,
	`error` text,
	`provider_message_id` text,
	`sent_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `campaign_send_campaign_idx` ON `campaign_send` (`organization_id`,`campaign_id`);--> statement-breakpoint
CREATE INDEX `campaign_send_customer_sent_idx` ON `campaign_send` (`organization_id`,`customer_id`,`sent_at`);--> statement-breakpoint
CREATE INDEX `campaign_send_campaign_status_idx` ON `campaign_send` (`campaign_id`,`status`);