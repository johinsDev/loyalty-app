/**
 * Stable cache key for a paginated/filtered admin list read. The Worker cache is
 * the only cache available for these reads — they're protected procedures, so the
 * cookie-forwarding RSC caller can't wrap them in Next's `use cache` (which
 * forbids dynamic APIs). The key MUST include the org and the full list input
 * (filters + sort + page), so a repeated filter hits the cache and a changed
 * filter is a distinct entry. See the `cache` + `nextjs-data-fetching-patterns`
 * skills.
 */
export function listCacheKey(name: string, orgId: string, input: unknown): string {
  // Deterministic stringify: sort keys so `{a,b}` and `{b,a}` hash equal.
  const stable = JSON.stringify(input, Object.keys(input as object).sort());
  return `list:${name}:${orgId}:${stable}`;
}
