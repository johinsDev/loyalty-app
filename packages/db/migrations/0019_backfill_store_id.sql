-- Backfill `store_id` on the loyalty write-path so the next migration can flip
-- the column to NOT NULL. Each row is attributed to its org's primary store
-- (falling back to the org's oldest store if none is flagged primary). For the
-- single-location pilot every past sale happened at the one store, so this is
-- exact. Runs AFTER the additive columns (0018) and BEFORE the notNull flip.

UPDATE `purchase`
SET `store_id` = (
  SELECT s.`id` FROM `store` s
  WHERE s.`organization_id` = `purchase`.`organization_id`
    AND s.`deleted_at` IS NULL
  ORDER BY s.`is_primary` DESC, s.`created_at` ASC
  LIMIT 1
)
WHERE `store_id` IS NULL;
--> statement-breakpoint
UPDATE `stamp`
SET `store_id` = (
  SELECT p.`store_id` FROM `purchase` p WHERE p.`id` = `stamp`.`purchase_id`
)
WHERE `store_id` IS NULL;
--> statement-breakpoint
UPDATE `points_transaction`
SET `store_id` = (
  SELECT s.`id` FROM `store` s
  WHERE s.`organization_id` = `points_transaction`.`organization_id`
    AND s.`deleted_at` IS NULL
  ORDER BY s.`is_primary` DESC, s.`created_at` ASC
  LIMIT 1
)
WHERE `store_id` IS NULL;
--> statement-breakpoint
UPDATE `redemption`
SET `store_id` = (
  SELECT s.`id` FROM `store` s
  WHERE s.`organization_id` = `redemption`.`organization_id`
    AND s.`deleted_at` IS NULL
  ORDER BY s.`is_primary` DESC, s.`created_at` ASC
  LIMIT 1
)
WHERE `store_id` IS NULL AND `organization_id` IS NOT NULL;
