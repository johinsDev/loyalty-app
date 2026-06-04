#!/usr/bin/env bash
#
# Boot the standalone API Worker locally with `wrangler dev` — the focused,
# Worker-only variant of what `bun run dev` already runs.
#
# Secrets reach the Worker via apps/api/.dev.vars (generated from Infisical by
# scripts/api/gen-dev-vars.sh, invoked by the package `dev` script). workerd does
# NOT inherit the parent shell env, so `.dev.vars` is how its `process.env` gets
# populated. See scripts/api/gen-dev-vars.sh for the why.
#
# Then point the FE at it: NEXT_PUBLIC_API_URL=http://localhost:8787 (set in
# Infisical dev /shared) to exercise the full cutover on dev data. Needs the
# local DB up — run `bun run dev:services` first.
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "${repo_root}/apps/api"
exec bun run dev
