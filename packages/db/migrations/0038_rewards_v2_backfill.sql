-- Rewards v2 backfill: map the boolean `active` flag onto the new lifecycle
-- `status`, and type every existing reward as `experience` (behavior-preserving
-- — the cashier keeps handing the item over, no ticket linkage) with a
-- fulfillment note seeded from its copy. The owner recreates a reward as
-- `freeProduct` via the wizard when she wants $0-line ticket linkage.
-- Runs AFTER the additive columns (0034) and BEFORE the destructive drop (0036).

UPDATE `reward` SET `status` = CASE WHEN `active` = 1 THEN 'published' ELSE 'draft' END;
--> statement-breakpoint
UPDATE `reward` SET `published_at` = `created_at`
  WHERE `status` = 'published' AND `published_at` IS NULL;
--> statement-breakpoint
UPDATE `reward` SET
  `type` = 'experience',
  `benefit` = json_object('type', 'experience'),
  `fulfillment_note` = COALESCE(`description`, `name`)
WHERE `type` IS NULL;
