#!/usr/bin/env bash
#
# Boot the standalone API Worker locally with `wrangler dev`, secrets injected
# from Infisical — no secrets on disk, mirroring scripts/with-infisical.sh.
#
# Key fact (verified): `wrangler dev` runs the Worker in workerd, and with
# `nodejs_compat` it surfaces the PARENT process env as `process.env` inside the
# Worker. So `infisical run -- wrangler dev` is enough — a tRPC call reaches the
# DB via DATABASE_URL, exactly like the deployed Worker reads its secrets. We do
# NOT need a `.dev.vars` file (which `infisical export` can't even build here,
# since this CLI lacks `--recursive` on `export`).
#
# Two wrinkles handled below:
#   - wrangler is a workspace devDep (node_modules/.bin), so it isn't on PATH
#     under `infisical run`; we invoke it via `bun --cwd apps/api run dev`.
#   - BETTER_AUTH_URL is forced to the wrangler port AFTER Infisical injection
#     (so it wins over the dev value), making Better Auth issue cookies + the
#     Google redirect URI against :8787. Its trustedOrigins already include
#     localhost:3002/3003 (web/admin), so cross-port auth works.
#
# Then point the FE at it: NEXT_PUBLIC_API_URL=http://localhost:8787 (per-app
# .env.local or Infisical dev) to exercise the full cutover on dev data. Needs
# the local DB up — run `bun run dev:services` first.
#
# Graceful, like scripts/with-infisical.sh: if Infisical is unavailable
# (no CLI / not linked / NO_INFISICAL=1 / CI) we boot wrangler unchanged and let
# its own .dev.vars / shell env apply.
#
# Env knobs:
#   INFISICAL_ENV   Infisical environment to pull from   (default: dev)
#   API_DEV_PORT    wrangler dev port                    (default: 8787)
#   NO_INFISICAL=1  skip Infisical entirely
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
api_dir="${repo_root}/apps/api"
env_name="${INFISICAL_ENV:-dev}"
port="${API_DEV_PORT:-8787}"

# The inner command: cd into apps/api (so wrangler's node_modules/.bin is on
# PATH and it finds wrangler.toml), pin BETTER_AUTH_URL (wins over any injected
# value), then boot wrangler via the package `dev` script. Default wrangler port
# is 8787; override with `wrangler dev --port` directly if you ever need another.
inner="cd '${api_dir}' && BETTER_AUTH_URL=http://localhost:${port} exec bun run dev"

use_infisical=1
[ "${NO_INFISICAL:-}" = "1" ] && use_infisical=0
[ "${CI:-}" = "true" ] && use_infisical=0
command -v infisical >/dev/null 2>&1 || use_infisical=0
[ -f "${repo_root}/.infisical.json" ] || use_infisical=0

if [ "$use_infisical" = "1" ]; then
  echo "→ Booting API Worker on http://localhost:${port} (Infisical env=${env_name})"
  exec infisical run --env="$env_name" --recursive --silent -- bash -c "$inner"
else
  echo "→ Booting API Worker on http://localhost:${port} (no Infisical)"
  exec bash -c "$inner"
fi
