#!/usr/bin/env bash
#
# Materialise apps/api/.dev.vars from Infisical for local `wrangler dev`.
#
# WHY this exists (corrects an earlier wrong assumption): `wrangler dev` runs the
# Worker in workerd, which does NOT inherit the parent shell's env. Even with
# `nodejs_compat`, the Worker's `process.env` is populated ONLY from wrangler
# `[vars]` + the `.dev.vars` (dotenv) file — never from `infisical run`'s
# injected env. So the Worker needs its secrets written to `.dev.vars`.
#
# `infisical export` (CLI 0.43.x) has no `--recursive`, so we export the two
# folders that hold the dev env explicitly (`/` + `/shared`; `/mcp` is MCP-only
# and skipped) and append Worker-local overrides last (dotenv = last wins):
#   - BETTER_AUTH_URL=http://localhost:8787  → issuer/redirect on the wrangler port.
#   - AUTH_PASSWORD_ENABLED=true             → email/password sign-in for local dev.
#
# `.dev.vars` is gitignored. Graceful: if Infisical is unavailable
# (no CLI / not linked / NO_INFISICAL=1 / CI) we keep any existing `.dev.vars`.
#
# Env knobs: INFISICAL_ENV (default dev), NO_INFISICAL=1 to skip.
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
api_dir="${repo_root}/apps/api"
dev_vars="${api_dir}/.dev.vars"
env_name="${INFISICAL_ENV:-dev}"

use_infisical=1
[ "${NO_INFISICAL:-}" = "1" ] && use_infisical=0
[ "${CI:-}" = "true" ] && use_infisical=0
command -v infisical >/dev/null 2>&1 || use_infisical=0
[ -f "${repo_root}/.infisical.json" ] || use_infisical=0

if [ "$use_infisical" != "1" ]; then
  if [ -f "$dev_vars" ]; then
    echo "→ Infisical unavailable — keeping existing apps/api/.dev.vars"
    exit 0
  fi
  echo "✗ No Infisical and no apps/api/.dev.vars. Run 'infisical login' (or" >&2
  echo "  'bun run env:bootstrap'), or create apps/api/.dev.vars by hand." >&2
  exit 1
fi

echo "→ Writing apps/api/.dev.vars from Infisical (env=${env_name})"
{
  infisical export --env="$env_name" --path=/ --format=dotenv --silent
  infisical export --env="$env_name" --path=/shared --format=dotenv --silent
  echo "BETTER_AUTH_URL=http://localhost:8787"
  echo "AUTH_PASSWORD_ENABLED=true"
} >"$dev_vars"
