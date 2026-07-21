import { sql, type SQLWrapper } from "drizzle-orm";

/**
 * Per-store availability for catalog rows (`product`, `reward`, `promo`,
 * `banner`). A row's `storeIds` JSON column is either `null`/empty — available
 * at **every** store — or a subset of store ids it's restricted to.
 */

/** Pure predicate mirroring {@link availableAtStore} — for in-memory filtering
 *  and as the tested source of truth for the semantics. */
export function isAvailableAt(storeIds: readonly string[] | null | undefined, storeId: string): boolean {
  if (!storeIds || storeIds.length === 0) return true;
  return storeIds.includes(storeId);
}

/** SQL predicate: the row's `storeIds` is null/empty (all stores) OR contains
 *  `storeId`. Use inside a WHERE, behind the org filter + pagination. */
export function availableAtStore(col: SQLWrapper, storeId: string) {
  return sql`(${col} IS NULL OR json_array_length(${col}) = 0 OR EXISTS (SELECT 1 FROM json_each(${col}) WHERE value = ${storeId}))`;
}
