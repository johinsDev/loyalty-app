-- Promos v2 backfill: compile every v0 promo (benefit/scopeKind/scope) into the
-- generic trigger/effect `rule` JSON, lift daysOfWeek/hours out of `conditions`
-- into the new `schedule` DSL, and rename the type discriminants. Runs AFTER
-- the additive columns (0031) and BEFORE the legacy-column drop (0033).
-- Drafts without a `benefit` keep `rule` NULL — the wizard forces re-completion.

-- percentage → percentOff
UPDATE `promo` SET
  `rule` = json_object(
    'buy', json_object('requirements', json(
      CASE `scope_kind`
        WHEN 'products' THEN json_array(json_object(
          'refs', json((SELECT json_group_array(json_object('kind', 'product', 'id', je.value))
                        FROM json_each(json_extract(`promo`.`scope`, '$.productIds')) AS je)),
          'qty', 1))
        WHEN 'categories' THEN json_array(json_object(
          'refs', json((SELECT json_group_array(json_object('kind', 'category', 'id', je.value))
                        FROM json_each(json_extract(`promo`.`scope`, '$.categoryIds')) AS je)),
          'qty', 1))
        ELSE json_array()
      END)),
    'effect', json_patch(
      json_object(
        'kind', 'percentOff',
        'percent', json_extract(`benefit`, '$.percent'),
        'target', CASE `scope_kind` WHEN 'products' THEN 'buy' WHEN 'categories' THEN 'buy' ELSE 'order' END),
      CASE WHEN COALESCE(json_extract(`benefit`, '$.maxDiscountCents'), json_extract(`conditions`, '$.maxDiscountCents')) IS NOT NULL
        THEN json_object('maxDiscountCents', COALESCE(json_extract(`benefit`, '$.maxDiscountCents'), json_extract(`conditions`, '$.maxDiscountCents')))
        ELSE json_object()
      END)),
  `type` = 'percentOff'
WHERE `type` = 'percentage' AND `benefit` IS NOT NULL;
--> statement-breakpoint
-- fixed → amountOff
UPDATE `promo` SET
  `rule` = json_object(
    'buy', json_object('requirements', json(
      CASE `scope_kind`
        WHEN 'products' THEN json_array(json_object(
          'refs', json((SELECT json_group_array(json_object('kind', 'product', 'id', je.value))
                        FROM json_each(json_extract(`promo`.`scope`, '$.productIds')) AS je)),
          'qty', 1))
        WHEN 'categories' THEN json_array(json_object(
          'refs', json((SELECT json_group_array(json_object('kind', 'category', 'id', je.value))
                        FROM json_each(json_extract(`promo`.`scope`, '$.categoryIds')) AS je)),
          'qty', 1))
        ELSE json_array()
      END)),
    'effect', json_object(
      'kind', 'amountOff',
      'amountCents', json_extract(`benefit`, '$.amountCents'),
      'target', CASE `scope_kind` WHEN 'products' THEN 'buy' WHEN 'categories' THEN 'buy' ELSE 'order' END)),
  `type` = 'amountOff'
WHERE `type` = 'fixed' AND `benefit` IS NOT NULL;
--> statement-breakpoint
-- nForM → nxm (empty refs = any unit, for order-wide N-for-M)
UPDATE `promo` SET
  `rule` = json_object(
    'buy', json_object('requirements', json(
      CASE `scope_kind`
        WHEN 'products' THEN json_array(json_object(
          'refs', json((SELECT json_group_array(json_object('kind', 'product', 'id', je.value))
                        FROM json_each(json_extract(`promo`.`scope`, '$.productIds')) AS je)),
          'qty', json_extract(`benefit`, '$.buyQty')))
        WHEN 'categories' THEN json_array(json_object(
          'refs', json((SELECT json_group_array(json_object('kind', 'category', 'id', je.value))
                        FROM json_each(json_extract(`promo`.`scope`, '$.categoryIds')) AS je)),
          'qty', json_extract(`benefit`, '$.buyQty')))
        ELSE json_array(json_object('refs', json_array(), 'qty', json_extract(`benefit`, '$.buyQty')))
      END)),
    'effect', json_object(
      'kind', 'freeUnits',
      'count', json_extract(`benefit`, '$.buyQty') - json_extract(`benefit`, '$.payQty'),
      'target', 'buy')),
  `type` = 'nxm'
WHERE `type` = 'nForM' AND `benefit` IS NOT NULL;
--> statement-breakpoint
-- freeItem → crossSell (buy = old scope, get = freeRef, 100% off, once per order)
UPDATE `promo` SET
  `rule` = json_object(
    'buy', json_object('requirements', json(
      CASE `scope_kind`
        WHEN 'products' THEN json_array(json_object(
          'refs', json((SELECT json_group_array(json_object('kind', 'product', 'id', je.value))
                        FROM json_each(json_extract(`promo`.`scope`, '$.productIds')) AS je)),
          'qty', 1))
        WHEN 'categories' THEN json_array(json_object(
          'refs', json((SELECT json_group_array(json_object('kind', 'category', 'id', je.value))
                        FROM json_each(json_extract(`promo`.`scope`, '$.categoryIds')) AS je)),
          'qty', 1))
        ELSE json_array()
      END)),
    'get', json_object('requirements', json_array(json_object(
      'refs', json_array(json_object(
        'kind', CASE json_extract(`benefit`, '$.freeRef.kind') WHEN 'modifier' THEN 'modifierOption' ELSE json_extract(`benefit`, '$.freeRef.kind') END,
        'id', json_extract(`benefit`, '$.freeRef.id'))),
      'qty', 1))),
    'effect', json_object('kind', 'percentOff', 'percent', 100, 'target', 'get'),
    'maxApplicationsPerOrder', 1),
  `type` = 'crossSell'
WHERE `type` = 'freeItem' AND `benefit` IS NOT NULL;
--> statement-breakpoint
-- pointsMultiplier keeps its type; rule gains the scoped trigger
UPDATE `promo` SET
  `rule` = json_object(
    'buy', json_object('requirements', json(
      CASE `scope_kind`
        WHEN 'products' THEN json_array(json_object(
          'refs', json((SELECT json_group_array(json_object('kind', 'product', 'id', je.value))
                        FROM json_each(json_extract(`promo`.`scope`, '$.productIds')) AS je)),
          'qty', 1))
        WHEN 'categories' THEN json_array(json_object(
          'refs', json((SELECT json_group_array(json_object('kind', 'category', 'id', je.value))
                        FROM json_each(json_extract(`promo`.`scope`, '$.categoryIds')) AS je)),
          'qty', 1))
        ELSE json_array()
      END)),
    'effect', json_object('kind', 'pointsMultiplier', 'multiplier', json_extract(`benefit`, '$.multiplier'))),
  `type` = 'pointsMultiplier'
WHERE `type` = 'pointsMultiplier' AND `benefit` IS NOT NULL;
--> statement-breakpoint
-- daysOfWeek / hoursFrom / hoursTo → schedule DSL
UPDATE `promo` SET `schedule` = json_patch(
  CASE WHEN json_extract(`conditions`, '$.daysOfWeek') IS NOT NULL
    THEN json_object('recurrence', json_object('kind', 'weekly', 'days', json(json_extract(`conditions`, '$.daysOfWeek'))))
    ELSE json_object()
  END,
  CASE WHEN json_extract(`conditions`, '$.hoursFrom') IS NOT NULL AND json_extract(`conditions`, '$.hoursTo') IS NOT NULL
    THEN json_object('timeWindow', json_object('from', json_extract(`conditions`, '$.hoursFrom'), 'to', json_extract(`conditions`, '$.hoursTo')))
    ELSE json_object()
  END)
WHERE `conditions` IS NOT NULL
  AND (json_extract(`conditions`, '$.daysOfWeek') IS NOT NULL
    OR (json_extract(`conditions`, '$.hoursFrom') IS NOT NULL AND json_extract(`conditions`, '$.hoursTo') IS NOT NULL));
--> statement-breakpoint
-- conditions v2: strip moved keys; firstPurchaseOnly → purchaseCount.max = 0
UPDATE `promo` SET `conditions` = json_patch(
  json_remove(`conditions`, '$.daysOfWeek', '$.hoursFrom', '$.hoursTo', '$.maxDiscountCents', '$.firstPurchaseOnly'),
  CASE WHEN json_extract(`conditions`, '$.firstPurchaseOnly') = 1
    THEN json_object('purchaseCount', json_object('max', 0))
    ELSE json_object()
  END)
WHERE `conditions` IS NOT NULL;
--> statement-breakpoint
-- rename types on benefit-less drafts too, so the new wizard recognizes them
UPDATE `promo` SET `type` = 'percentOff' WHERE `type` = 'percentage';
--> statement-breakpoint
UPDATE `promo` SET `type` = 'amountOff' WHERE `type` = 'fixed';
--> statement-breakpoint
UPDATE `promo` SET `type` = 'nxm' WHERE `type` = 'nForM';
--> statement-breakpoint
UPDATE `promo` SET `type` = 'crossSell' WHERE `type` = 'freeItem';
