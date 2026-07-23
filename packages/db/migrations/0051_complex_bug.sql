ALTER TABLE `organization_settings` ADD `tier_stacks_with_promo` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `reward_stacks_with_promo` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `max_total_discount_pct` integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `promo` ADD `exclusive` integer DEFAULT false NOT NULL;