#!/usr/bin/env bash
#
# Graceful Infisical env wrapper.
#
# Runs the given command with secrets injected from Infisical IF, and only
# if, all of these hold:
#
#   1. the `infisical` CLI is installed,
#   2. this repo is linked to an Infisical project (`.infisical.json` exists),
#   3. we are NOT in CI (CI brings its own stub env — see .github/workflows),
#   4. NO_INFISICAL is not set.
#
# Otherwise it falls back to running the command unchanged, so the existing
# `.env` / direnv path keeps working. This makes adopting Infisical
# non-breaking: until you finish the one-time bootstrap (which creates
# `.infisical.json`), nothing about your local flow changes.
#
# Env knobs:
#   INFISICAL_ENV   Infisical environment to pull from   (default: dev)
#   NO_INFISICAL=1  force the fallback, skip Infisical entirely
#
# Usage (from package.json scripts):
#   bash scripts/with-infisical.sh <command> [args...]
#
set -euo pipefail

env_name="${INFISICAL_ENV:-dev}"

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

use_infisical=1
[ "${NO_INFISICAL:-}" = "1" ] && use_infisical=0
[ "${CI:-}" = "true" ] && use_infisical=0
command -v infisical >/dev/null 2>&1 || use_infisical=0
[ -f "${repo_root}/.infisical.json" ] || use_infisical=0

if [ "$use_infisical" = "1" ]; then
  # `--recursive` flattens every folder (/shared /web /admin /jobs
  # /partykit) so a single local process gets the whole env. Per-app
  # scoping is a deploy concern (the Infisical→Vercel integration), not
  # a local one. If you are not logged in, Infisical prints a clear
  # "infisical login" hint and exits — that is the right nudge once
  # you have opted in by creating .infisical.json.
  exec infisical run --env="$env_name" --recursive --silent -- "$@"
else
  exec "$@"
fi
