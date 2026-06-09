#!/usr/bin/env bash
#
# Regenerate the repo-root .env from Infisical for local dev.
#
# Writes .env IN PLACE (never via `> .env` — that truncates before this runs
# and the old footgun lost the bootstrap creds). Two things make it safe:
#
#   1. `infisical export` has NO `--recursive` (the old script used it and just
#      errored), so we export each folder that exists and concatenate.
#   2. INFISICAL_UNIVERSAL_AUTH_CLIENT_ID/SECRET — the machine-identity creds the
#      Infisical MCP authenticates with — live ONLY in .env (deliberately NOT in
#      the vault: they're the master key TO the vault). We preserve them from the
#      existing .env so a pull never drops them.
#
# A guard refuses to overwrite .env if the result has no bootstrap creds (e.g.
# `infisical login` expired), so a failed pull can't blank your .env.
#
# Usage:  bun run env:pull           # dev (default)
#         INFISICAL_ENV=staging bun run env:pull
set -euo pipefail

env_name="${INFISICAL_ENV:-dev}"
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
target="${repo_root}/.env"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

# Export each folder (missing folders error → skipped). Covers dev (/ /shared
# /mcp) and the deploy envs (/api /ci) for the same script.
for path in / /shared /mcp /api /ci; do
  infisical export --env="$env_name" --path="$path" --format=dotenv --silent 2>/dev/null >>"$tmp" || true
done

# Preserve the bootstrap creds that are NOT in Infisical.
if [ -f "$target" ]; then
  grep -E '^INFISICAL_UNIVERSAL_AUTH_(CLIENT_ID|CLIENT_SECRET)=.+' "$target" >>"$tmp" || true
fi

# Guard: never write a .env that can't authenticate the Infisical MCP.
if [ ! -s "$tmp" ] || ! grep -q '^INFISICAL_UNIVERSAL_AUTH_CLIENT_ID=.\+' "$tmp"; then
  echo "✗ env:pull produced no bootstrap creds — refusing to overwrite .env." >&2
  echo "  Run 'infisical login', and keep INFISICAL_UNIVERSAL_AUTH_* in the existing .env." >&2
  exit 1
fi

mv "$tmp" "$target"
trap - EXIT
echo "✓ .env regenerated for env=${env_name} ($(grep -c '=' "$target") vars). Run 'direnv reload'."
