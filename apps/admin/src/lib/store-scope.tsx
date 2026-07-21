"use client";

import type { StoreSwitcherItem } from "@loyalty/api/features/stores/schemas";
import { createContext, type ReactNode, useContext, useMemo } from "react";

/** Sentinel for the aggregate ("all stores") view — kept in sync with the API's
 *  `ALL_STORES`. Duplicated here so client components don't import server code. */
export const ALL_STORES = "all";

export interface StoreScopeValue {
  /** The active `[storeId]` route segment: `"all"` or a real store id. */
  segment: string;
  /** `null` in the aggregate view; the active store id otherwise. */
  storeId: string | null;
  /** The active store row, or `null` when aggregating. */
  store: StoreSwitcherItem | null;
  /** All active stores (for the switcher). */
  stores: StoreSwitcherItem[];
}

export const StoreScopeContext = createContext<StoreScopeValue | null>(null);

export function StoreScopeProvider({
  value,
  children,
}: {
  value: StoreScopeValue;
  children: ReactNode;
}) {
  const memo = useMemo(() => value, [value.segment, value.stores]);
  return <StoreScopeContext.Provider value={memo}>{children}</StoreScopeContext.Provider>;
}

export function useStoreScope(): StoreScopeValue {
  const ctx = useContext(StoreScopeContext);
  if (!ctx) throw new Error("useStoreScope must be used inside <StoreScopeProvider>");
  return ctx;
}

/**
 * Build the next-intl `href` for a bare dashboard route key (e.g. `/customers`)
 * under the active store segment. Routes live at `/[storeId]/...`, so links need
 * the object form with `params.storeId`; the nav stores bare keys and prefixes
 * at render time so a link always targets the store you're currently in.
 */
export function storeHref(segment: string, key: string, extra?: Record<string, string>) {
  const clean = key === "/" ? "" : key;
  return {
    pathname: `/[storeId]${clean}`,
    params: { storeId: segment, ...extra },
  };
}

/** Strip the leading `/[storeId]` segment from a resolved pathname (from
 *  next-intl's `usePathname`, which uses canonical slugs + real segment values,
 *  e.g. `/all/customers`) so it can be matched against a bare nav key. */
export function stripStoreSegment(pathname: string): string {
  const rest = pathname.replace(/^\/[^/]+/, "");
  return rest === "" ? "/" : rest;
}
