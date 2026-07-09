-- No-op reconciliation migration.
--
-- This branch (rewards v2 + dashboard + products + ingredients, migrations
-- 0037-0043) was renumbered on top of main's 0034-0036, which already added
-- the purchase attribution/void columns + the partial points_tx index (#192).
-- Drizzle regenerated those statements here because the renumbered snapshots
-- predate #192; they are intentionally omitted so migrating a DB that already
-- ran 0034-0036 doesn't fail on "duplicate column". The accompanying snapshot
-- captures the true, reconciled schema so future `db:generate` is clean.
SELECT 1;
