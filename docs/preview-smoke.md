# Preview pipeline smoke test

A throwaway marker used to exercise the per-PR preview pipeline end-to-end
without shipping any real change. Opening a PR with this file triggers
`.github/workflows/preview.yml`, which should:

- clone production into a masked `preview-pr-<n>` Turso database
- apply this PR's migrations + mask PII + seed the deterministic preview admin
- pin the per-PR `DATABASE_URL` / `TURSO_AUTH_TOKEN` on the Vercel web + admin
  previews, plus the `STORAGE_KEY_PREFIX`, `CACHE_KEY_PREFIX` and
  `REALTIME_ROOM_PREFIX` namespaces
- trigger the real Vercel preview build and deploy a Trigger.dev preview branch

When the PR closes, `preview-cleanup.yml` tears the preview DB back down.

This file carries no runtime meaning — delete it (or close the PR unmerged)
once the run is verified.

Run: 2026-05-31.
