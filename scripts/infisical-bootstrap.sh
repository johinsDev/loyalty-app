#!/usr/bin/env bash
#
# One-time (re-runnable) Infisical bootstrap.
#
# Turns "click ~50 secrets into the dashboard" into one command. It:
#
#   1. checks the `infisical` CLI is installed, you are logged in, and
#      this repo is linked (`.infisical.json` — run `infisical init` first),
#   2. creates the folder structure
#         /shared /web /admin /jobs /partykit /mcp
#      in every environment (dev, preview, prod) — idempotent,
#   3. optionally imports an existing dotenv file into ONE target
#      environment, routing each variable to its folder per the matrix
#      below (the same matrix documented in .env.example and the
#      `env-deploy` skill).
#
# Prereqs (one-time, interactive — the CLI has no non-interactive flag
# for these, so you run them by hand once):
#   infisical login                 # browser auth
#   infisical init                  # pick/create the "loyalty-app" project
#                                   # → writes .infisical.json (commit it)
#   # In the Infisical dashboard, ensure the project has exactly these
#   # three environments (slugs): dev, preview, prod. New projects ship
#   # dev/staging/prod — rename "staging" to "preview" (slug `preview`).
#
# Usage:
#   bash scripts/infisical-bootstrap.sh                 # folders only
#   bash scripts/infisical-bootstrap.sh --import .env --env dev
#
# Re-running is safe: folder creation tolerates "already exists" and
# `secrets set` upserts.
#
set -euo pipefail

ENVS=(dev preview prod)
FOLDERS=(/shared /web /admin /jobs /partykit /mcp)

import_file=""
target_env="dev"
while [ $# -gt 0 ]; do
  case "$1" in
    --import) import_file="$2"; shift 2 ;;
    --env)    target_env="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

command -v infisical >/dev/null 2>&1 || {
  echo "✗ infisical CLI not found. brew install infisical/get-cli/infisical" >&2
  exit 1
}
[ -f .infisical.json ] || {
  echo "✗ .infisical.json missing. Run: infisical login && infisical init" >&2
  exit 1
}

# VAR → folder. Anything not listed defaults to /shared. Keep in sync
# with the matrix in .env.example. Platform-injected vars (VERCEL_URL,
# VERCEL_ENV, VERCEL_PROJECT_PRODUCTION_URL) are intentionally absent —
# never store those.
folder_for() {
  case "$1" in
    # --- web only ---
    NEXT_PUBLIC_APP_URL|NEXT_PUBLIC_VAPID_PUBLIC_KEY|NEXT_PUBLIC_PARTYKIT_HOST|\
    BETTER_STACK_SOURCE_TOKEN_WEB|BETTER_STACK_INGESTING_HOST_WEB) echo /web ;;
    # --- admin only ---
    BETTER_AUTH_SECRET|BETTER_AUTH_URL|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|\
    BETTER_STACK_SOURCE_TOKEN_ADMIN|BETTER_STACK_INGESTING_HOST_ADMIN) echo /admin ;;
    # --- jobs only (Trigger.dev) ---
    TRIGGER_PROJECT_ID|TRIGGER_SECRET_KEY|OUTBOX_RETENTION_DAYS|\
    BETTER_STACK_SOURCE_TOKEN_JOBS|BETTER_STACK_INGESTING_HOST_JOBS) echo /jobs ;;
    # --- partykit (realtime worker) ---
    PARTYKIT_HOST|PARTYKIT_PROJECT) echo /partykit ;;
    # --- MCP / local tooling tokens (never on a deploy target) ---
    BETTER_STACK_API_TOKEN|BETTER_STACK_TELEMETRY_API_TOKEN|\
    SLACK_BOT_TOKEN|SLACK_TEAM_ID|SENTRY_AUTH_TOKEN) echo /mcp ;;
    # --- everything else: shared by 2+ runtimes ---
    *) echo /shared ;;
  esac
}

echo "→ Creating folder structure in: ${ENVS[*]}"
for e in "${ENVS[@]}"; do
  for f in "${FOLDERS[@]}"; do
    name="${f#/}"
    infisical secrets folders create -n "$name" -p / --env "$e" --silent \
      >/dev/null 2>&1 && echo "  + $e:$f" || echo "  = $e:$f (exists)"
  done
done

if [ -n "$import_file" ]; then
  [ -f "$import_file" ] || { echo "✗ import file not found: $import_file" >&2; exit 1; }
  echo "→ Importing $import_file into env '$target_env'"
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|\#*) continue ;; esac
    key="${line%%=*}"
    val="${line#*=}"
    [ -z "$key" ] && continue
    [ "$key" = "$line" ] && continue          # no '=' on the line
    val="${val%\"}"; val="${val#\"}"          # strip surrounding quotes
    [ -z "$val" ] && continue                 # skip empty values
    folder="$(folder_for "$key")"
    infisical secrets set "$key=$val" --env "$target_env" --path "$folder" --silent \
      >/dev/null 2>&1 && echo "  → $target_env:$folder/$key" \
      || echo "  ✗ failed: $key" >&2
  done < "$import_file"
fi

echo "✓ Bootstrap done. Verify: infisical secrets --env=$target_env --recursive"
