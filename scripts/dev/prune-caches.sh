#!/usr/bin/env bash
# Cap the build caches that grow without bound.
#
# Neither turbo nor Next prunes its own on-disk cache. `turbo --help` offers only
# `--cache-dir` (relocate) and `--no-cache` (disable) — no TTL, no size limit — so
# `.turbo/cache` grew to 283 GB / 23,535 entries over three months here, and the
# `.next` caches to another 70 GB. This is the missing eviction policy.
#
# Two passes over each cache: drop anything older than MAX_AGE_DAYS, then, if it
# is still over its cap, drop oldest-first until it fits. Deleting a cache entry
# only costs a rebuild.
#
#   bun run cache:prune            # prune if the last run was over a day ago
#   bun run cache:prune --force    # prune now
#   bun run cache:prune --dry-run  # report only
#
# Tunables (env): TURBO_CACHE_MAX_GB, NEXT_CACHE_MAX_GB, MAX_AGE_DAYS.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TURBO_CACHE_MAX_GB="${TURBO_CACHE_MAX_GB:-10}"
NEXT_CACHE_MAX_GB="${NEXT_CACHE_MAX_GB:-5}"
MAX_AGE_DAYS="${MAX_AGE_DAYS:-14}"
STAMP="$ROOT/.turbo/.last-prune"
MIN_INTERVAL_SECONDS=$((24 * 60 * 60))

DRY_RUN=0
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --force) FORCE=1 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

# Called from a git hook on every merge/checkout, so make the common case free:
# stat one file and leave. A full pass walks tens of thousands of entries.
if [ "$FORCE" -eq 0 ] && [ "$DRY_RUN" -eq 0 ] && [ -f "$STAMP" ]; then
  now=$(date +%s)
  last=$(stat -f %m "$STAMP" 2>/dev/null || stat -c %Y "$STAMP" 2>/dev/null || echo 0)
  if [ $((now - last)) -lt "$MIN_INTERVAL_SECONDS" ]; then
    exit 0
  fi
fi

size_mb() { du -sm "$1" 2>/dev/null | cut -f1; }
human() {
  if [ "$1" -ge 1024 ]; then echo "$(( $1 / 1024 )) GB"; else echo "$1 MB"; fi
}

rm_path() {
  if [ "$DRY_RUN" -eq 1 ]; then return 0; fi
  rm -rf "$1"
}

# Trim $dir to $cap_mb by deleting its immediate children oldest-first. Turbo
# writes each entry as a `<hash>.tar.zst` next to its `<hash>-meta.json`; both
# share an mtime, so oldest-first removes them together.
trim_to_cap() {
  local dir="$1" cap_mb="$2" current
  current=$(size_mb "$dir")
  [ -z "$current" ] && return 0
  [ "$current" -le "$cap_mb" ] && return 0

  # Oldest first. -print0 keeps this correct for any filename.
  while IFS= read -r -d '' entry; do
    [ "$current" -le "$cap_mb" ] && break
    local entry_mb
    entry_mb=$(du -sm "$entry" 2>/dev/null | cut -f1 || echo 0)
    rm_path "$entry"
    current=$((current - entry_mb))
  done < <(find "$dir" -mindepth 1 -maxdepth 1 -print0 2>/dev/null |
    xargs -0 stat -f '%m %N' 2>/dev/null |
    sort -n |
    cut -d' ' -f2- |
    tr '\n' '\0')
}

prune_cache() {
  local dir="$1" cap_gb="$2" label="$3" before after
  [ -d "$dir" ] || return 0
  before=$(size_mb "$dir")
  [ -z "$before" ] && return 0

  if [ "$DRY_RUN" -eq 0 ]; then
    find "$dir" -mindepth 1 -maxdepth 1 -mtime "+$MAX_AGE_DAYS" -exec rm -rf {} + 2>/dev/null || true
  fi
  trim_to_cap "$dir" $((cap_gb * 1024))

  after=$(size_mb "$dir")
  if [ "$before" != "$after" ]; then
    echo "  $label: $(human "$before") → $(human "$after")"
  fi
}

echo "prune-caches: >$MAX_AGE_DAYS días, turbo ≤${TURBO_CACHE_MAX_GB}GB, next ≤${NEXT_CACHE_MAX_GB}GB$([ "$DRY_RUN" -eq 1 ] && echo ' (dry-run)')"

# The main checkout plus every worktree — each carries its own full set.
while IFS= read -r base; do
  [ -d "$base" ] || continue
  name=$(basename "$base")
  prune_cache "$base/.turbo/cache" "$TURBO_CACHE_MAX_GB" "$name/.turbo"
  for app in "$base"/apps/*/.next/cache; do
    [ -d "$app" ] || continue
    app_name=$(basename "$(dirname "$(dirname "$app")")")
    prune_cache "$app" "$NEXT_CACHE_MAX_GB" "$name/$app_name/.next"
  done
done < <(printf '%s\n' "$ROOT"; ls -d "$ROOT"/.claude/worktrees/*/ 2>/dev/null || true)

if [ "$DRY_RUN" -eq 0 ]; then
  mkdir -p "$(dirname "$STAMP")"
  touch "$STAMP"
fi
