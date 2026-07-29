import { cachedRead } from "../../trpc";

/**
 * Stable cache key for a paginated/filtered admin list read. The Worker cache is
 * the only cache available for these reads — they're protected procedures, so the
 * cookie-forwarding RSC caller can't wrap them in Next's `use cache` (which
 * forbids dynamic APIs). The key MUST include the org and the full list input
 * (filters + sort + page), so a repeated filter hits the cache and a changed
 * filter is a distinct entry. It also includes a per-(entity, org) `version`
 * segment (see `bumpListVersion`) so a mutation can invalidate every cached
 * list for that entity/org instantly, without a pattern/prefix delete. See the
 * `cache` + `nextjs-data-fetching-patterns` skills.
 */
export function listCacheKey(
  name: string,
  orgId: string,
  version: string,
  input: unknown,
): string {
  return `list:${name}:${orgId}:v${version}:${stableStringify(input)}`;
}

/** TTL (seconds) for the admin list read-through cache — matches the dashboard aggregates' TTL. */
export const LIST_CACHE_TTL_SECONDS = 60;

/**
 * Entities whose `adminList` reads are Worker-cached + version-invalidated.
 * The names MUST match the router segment (`customers.create` → "customers")
 * so the mutation middleware can map a mutation path to its entity.
 */
export const LIST_CACHED_ENTITIES = new Set([
  "customers",
  "purchases",
  "rewards",
  "promotions",
  "banners",
  "campaigns",
  "employees",
] as const);

/**
 * Minimal structural slice of `CacheBinding` needed here. Defined locally
 * (rather than imported from `../../trpc`) so `trpc.ts` can import
 * `bumpListVersion`/`LIST_CACHED_ENTITIES` from this module without creating
 * a value import cycle.
 */
interface ListCacheStore {
  getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T>;
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Version key for an entity's list cache within an org. Persisted longer than
 *  any list entry (24h) so it never expires mid-window and resets to collide
 *  with still-live `v<old>` entries; a bump writes a fresh monotonic token. */
function listVersionKey(entity: string, orgId: string): string {
  return `listver:${entity}:${orgId}`;
}

const LIST_VERSION_TTL_SECONDS = 86_400;

/** Current version token for (entity, org) — "0" when never bumped. */
export async function listVersion(
  ctx: { cache?: Pick<ListCacheStore, "get"> },
  entity: string,
  orgId: string,
): Promise<string> {
  if (!ctx.cache) return "0";
  try {
    return (await ctx.cache.get<string>(listVersionKey(entity, orgId))) ?? "0";
  } catch {
    // Fail open, like `cachedRead`. An unreachable cache must degrade an admin
    // list to an uncached read, not 500 it. Falling back to "0" only risks
    // reusing a pre-bump key, and `cachedRead` is about to bypass the cache
    // anyway for the same reason.
    return "0";
  }
}

/** Bump an entity's list version so every cached list for that org is
 *  immediately unreachable. Called by the mutation middleware. Fail-open. */
export async function bumpListVersion(
  ctx: { cache?: Pick<ListCacheStore, "set"> },
  entity: string,
  orgId: string,
): Promise<void> {
  if (!ctx.cache) return;
  // A monotonic token; `Date.now()` is available in the Worker runtime.
  await ctx.cache.set(listVersionKey(entity, orgId), String(Date.now()), LIST_VERSION_TTL_SECONDS);
}

/**
 * Read-through cache for an admin list read, versioned so a mutation bump
 * invalidates it instantly. Reads the entity's current version, folds it into
 * the key, then caches under the shared list TTL. This is what the seven
 * `adminList`/`list` procedures call instead of `cachedRead` + `listCacheKey`
 * directly.
 */
export async function cachedListRead<T>(
  ctx: { cache?: ListCacheStore },
  entity: string,
  orgId: string,
  input: unknown,
  factory: () => Promise<T>,
): Promise<T> {
  const version = await listVersion(ctx, entity, orgId);
  return cachedRead(ctx, listCacheKey(entity, orgId, version, input), LIST_CACHE_TTL_SECONDS, factory);
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
