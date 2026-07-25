"use client";

import type { StoreSwitcherItem } from "@loyalty/api/features/stores/schemas";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useMemo } from "react";

import { useTRPC } from "@/lib/trpc/client";

/** Sentinel for the aggregate ("all stores") view — kept in sync with the API's
 *  `ALL_STORES`. Duplicated here so client components don't import server code. */
export const ALL_STORES = "all";

export interface StoreScopeValue {
  /** The active `[storeId]` route segment: `"all"` or a real store id/slug. */
  segment: string;
  /** `null` in the aggregate view; the active store id otherwise. */
  storeId: string | null;
  /** The active store row, or `null` when aggregating. */
  store: StoreSwitcherItem | null;
  /** All active stores (for the switcher). */
  stores: StoreSwitcherItem[];
}

function resolveScope(stores: StoreSwitcherItem[], segment: string) {
  if (segment === ALL_STORES) {
    return { storeId: null as string | null, store: null as StoreSwitcherItem | null };
  }
  const store = stores.find((s) => s.slug === segment || s.id === segment) ?? null;
  return { storeId: store?.id ?? null, store };
}

/**
 * Active store scope, resolved **client-side** from the `[storeId]` URL segment
 * (`useParams`) + a hydrated `switcherList` query, so no server round-trip blocks
 * the shell. The list is Worker-cached and prefetched server-side, so the switcher
 * label is correct on first paint. Consumers read `useParams`, so they are dynamic
 * and must live inside a `<Suspense>` boundary (every shell island / page is).
 */
export function useStoreScope(): StoreScopeValue {
  const params = useParams();
  const segment = typeof params.storeId === "string" ? params.storeId : ALL_STORES;
  const trpc = useTRPC();
  const { data } = useQuery({ ...trpc.stores.switcherList.queryOptions(), staleTime: 60_000 });
  const stores = useMemo(() => data ?? [], [data]);
  return useMemo<StoreScopeValue>(
    () => ({ segment, ...resolveScope(stores, segment), stores }),
    [segment, stores],
  );
}
