-- Link each org's card prize to its existing free-drink reward, but only when
-- the choice is unambiguous: exactly one published freeProduct reward priced at
-- the pilot goal (9 stamps). Orgs left unlinked fall back at runtime (goal 9,
-- generic gift copy) and get an admin nudge. Idempotent: only fills NULLs.
UPDATE `organization_settings`
SET `stamps_card_reward_id` = (
  SELECT `id` FROM `reward`
  WHERE `reward`.`organization_id` = `organization_settings`.`organization_id`
    AND `reward`.`status` = 'published'
    AND `reward`.`type` = 'freeProduct'
    AND `reward`.`stamps_required` = 9
)
WHERE `stamps_card_reward_id` IS NULL
  AND (
    SELECT count(*) FROM `reward`
    WHERE `reward`.`organization_id` = `organization_settings`.`organization_id`
      AND `reward`.`status` = 'published'
      AND `reward`.`type` = 'freeProduct'
      AND `reward`.`stamps_required` = 9
  ) = 1;
