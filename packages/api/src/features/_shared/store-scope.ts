/**
 * The admin's active-store scope, derived from the `[storeId]` route segment.
 *
 * The segment is either the sentinel `"all"` (aggregate — no store filter) or a
 * real store id. `resolveStoreScope` validates the segment against the org's
 * live store list (already loaded for the switcher), so it stays a pure,
 * db-free function: `null` means the segment is invalid and the caller should
 * redirect to `/all`.
 */

export const ALL_STORES = "all" as const;

export interface StoreScope<T> {
  /** `null` when aggregating across all stores; a store id otherwise. */
  storeId: string | null;
  /** The resolved store row, or `null` in the aggregate view. */
  store: T | null;
}

/** Resolve the `[storeId]` segment against the org's stores. `null` = invalid. */
export function resolveStoreScope<T extends { id: string }>(
  stores: readonly T[],
  segment: string,
): StoreScope<T> | null {
  if (segment === ALL_STORES) return { storeId: null, store: null };
  const store = stores.find((s) => s.id === segment);
  return store ? { storeId: store.id, store } : null;
}
