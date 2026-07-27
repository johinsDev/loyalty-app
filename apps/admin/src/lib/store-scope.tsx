"use client";

import type { StoreSwitcherItem } from "@loyalty/api/features/stores/schemas";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { createContext, type ReactNode, useContext, useEffect, useMemo } from "react";

import {
  usePathname as useIntlPathname,
  useRouter as useIntlRouter,
} from "@/i18n/navigation";
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

/**
 * Server-resolved seed for the `switcherList` query. Populated by an RSC hole
 * (`ScopeIslands`) that `await`s the store list before rendering, so the client
 * islands wrapped by it (`StoreSwitcher`, `CashierButton`) have the list on their
 * FIRST render — the switcher label is right and the cashier button gets the
 * correct `storeId` with zero flash. `undefined` outside the provider (page
 * consumers), where the hook falls back to a plain `useQuery`.
 */
const StoreScopeSeedContext = createContext<StoreSwitcherItem[] | undefined>(undefined);

export function StoreScopeSeedProvider({
  stores,
  children,
}: {
  stores: StoreSwitcherItem[];
  children: ReactNode;
}) {
  return (
    <StoreScopeSeedContext.Provider value={stores}>{children}</StoreScopeSeedContext.Provider>
  );
}

function resolveScope(stores: StoreSwitcherItem[], segment: string) {
  if (segment === ALL_STORES) {
    return { storeId: null as string | null, store: null as StoreSwitcherItem | null };
  }
  const store = stores.find((s) => s.slug === segment || s.id === segment) ?? null;
  return { storeId: store?.id ?? null, store };
}

/**
 * Bounce an unknown `[storeId]` segment (a stale slug that resolves to no store)
 * to the `/all` equivalent of the current route — restoring the redirect the old
 * blocking layout did. Only fires once the query has RESOLVED (`resolved`, so
 * never mid-fetch and never on a transient error, which keeps `data` undefined),
 * and the condition self-clears after navigation (segment becomes `"all"`), so it
 * cannot loop.
 */
function useUnknownSegmentRedirect(
  segment: string,
  store: StoreSwitcherItem | null,
  resolved: boolean,
) {
  const router = useIntlRouter();
  const pathname = useIntlPathname();
  useEffect(() => {
    if (!resolved || segment === ALL_STORES || store !== null) return;
    const section = pathname.split("/").filter(Boolean)[1] ?? "dashboard";
    router.replace({
      pathname: `/[storeId]/${section}` as never,
      params: { storeId: ALL_STORES },
    });
  }, [resolved, segment, store, pathname, router]);
}

/**
 * Active store scope, resolved **client-side** from the `[storeId]` URL segment
 * (`useParams`) + the `switcherList` query. On store-scoped routes the query is
 * seeded server-side via {@link StoreScopeSeedProvider} (`initialData`), so the
 * first render already has the store list — correct switcher label + cashier
 * scope with no flash and no duplicate client fetch. Consumers read `useParams`,
 * so they are dynamic and must live inside a `<Suspense>` boundary (every shell
 * island / page is).
 */
export function useStoreScope(): StoreScopeValue {
  const params = useParams();
  const segment = typeof params.storeId === "string" ? params.storeId : ALL_STORES;
  const trpc = useTRPC();
  const seed = useContext(StoreScopeSeedContext);
  // Only seed from a non-empty server result: an empty seed (a failed server
  // read) would otherwise stick for `staleTime` instead of the client retrying.
  const hasSeed = seed !== undefined && seed.length > 0;
  const { data } = useQuery({
    ...trpc.stores.switcherList.queryOptions(),
    staleTime: 60_000,
    ...(hasSeed ? { initialData: seed } : {}),
  });
  const stores = useMemo(() => data ?? [], [data]);
  const scope = useMemo(() => resolveScope(stores, segment), [stores, segment]);

  useUnknownSegmentRedirect(segment, scope.store, data !== undefined);

  return useMemo<StoreScopeValue>(
    () => ({ segment, storeId: scope.storeId, store: scope.store, stores }),
    [segment, scope, stores],
  );
}
