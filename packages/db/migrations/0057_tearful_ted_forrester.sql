CREATE INDEX `purchase_customer_idx` ON `purchase` (`customer_id`);--> statement-breakpoint
CREATE INDEX `purchase_org_created_idx` ON `purchase` (`organization_id`,`created_at`);