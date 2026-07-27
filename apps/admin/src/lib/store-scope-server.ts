import "server-only";

import { resolveStoreScope } from "@loyalty/api/features/_shared/store-scope";
import { cache } from "react";

import { trpc } from "@/lib/trpc/server";

/**
 * Resolve the `/[store]` route segment (a slug, or `"all"`) to the org's store
 * list + the active scope, server-side. Wrapped in React `cache()` so the layout
 * and the page in the same request share one `switcherList` fetch (and the same
 * resolution) — the layout provides the context, pages read `scope.storeId` (the
 * real id) to scope their RSC prefetch to match the client's query key.
 */
export const loadStoreScope = cache(async (segment: string) => {
  const api = await trpc();
  const stores = await api.stores.switcherList().catch(() => []);
  return { stores, scope: resolveStoreScope(stores, segment) };
});
