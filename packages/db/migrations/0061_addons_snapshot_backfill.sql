-- Add-on sales snapshot backfill: expand the id-only `purchase_item.addon_ids`
-- JSON array into one `purchase_item_addon` row per add-on, freezing the name,
-- price and cost as they stand today. Historical tickets previously re-resolved
-- names against the live catalog, so a rename rewrote old receipts and a delete
-- dropped the label entirely.
--
-- Today's catalog values are the best available approximation for past sales —
-- there is no price history to recover. From here on the register writes the
-- snapshot at sale time, so this drift stops accumulating.
--
-- Runs AFTER the additive schema (0059). `json_each` is available in the SQLite
-- build Turso/libSQL ships. Rows whose add-on no longer exists are skipped by
-- the JOIN rather than inserted with a null name.

INSERT INTO `purchase_item_addon` (
  `id`, `purchase_item_id`, `addon_id`, `name`, `price_cents`, `cost_cents`, `qty`, `sort_order`
)
SELECT
  lower(hex(randomblob(16))),
  pi.`id`,
  a.`id`,
  a.`name`,
  a.`price_delta_cents`,
  a.`cost_cents`,
  1,
  je.`key`
FROM `purchase_item` pi
JOIN json_each(pi.`addon_ids`) je
JOIN `addon` a ON a.`id` = je.`value`
WHERE pi.`addon_ids` IS NOT NULL
  AND json_valid(pi.`addon_ids`)
  AND json_array_length(pi.`addon_ids`) > 0;
