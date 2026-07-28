CREATE INDEX `loyalty_card_org_idx` ON `loyalty_card` (`organization_id`);--> statement-breakpoint
CREATE INDEX `points_account_org_idx` ON `points_account` (`organization_id`);--> statement-breakpoint
CREATE INDEX `redemption_org_created_idx` ON `redemption` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `streak_org_status_idx` ON `streak` (`organization_id`,`status`);