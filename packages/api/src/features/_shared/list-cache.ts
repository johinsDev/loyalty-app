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
  return `list:${name}:${orgId}:${stableStringify(input)}`;
}

/**
 * Deterministic JSON: object keys sorted recursively at every level so key order
 * never changes the string; array order is preserved (it's meaningful — e.g. the
 * `sort` array encodes multi-column precedence). Unlike `JSON.stringify`'s
 * array-replacer form, this keeps nested object fields (the `{ id, desc }` sort
 * items) instead of collapsing them to `{}`. Callers must pass JSON-plain values;
 * `Date` is normalized to its ISO string, other exotic types (Map/Set/RegExp)
 * are unsupported and would misbehave (collapse to `{}` like the sort bug did).
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const body = Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",");
  return `{${body}}`;
}
