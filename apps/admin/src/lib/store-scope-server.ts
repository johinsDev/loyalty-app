import "server-only";

import {
  ALL_STORES,
  resolveStoreScope,
} from "@loyalty/api/features/_shared/store-scope";
import { cache } from "react";

import { trpc } from "@/lib/trpc/server";

type Store = Awaited<ReturnType<Awaited<ReturnType<typeof trpc>>["stores"]["switcherList"]>>[number];

/** The org's stores for the switcher. `cache()`d so the shell island and any
 *  scoped page in the same request share one `switcherList` fetch. */
export const loadStores = cache(
  async (): Promise<Store[]> => (await trpc()).stores.switcherList().catch(() => []),
);

/**
 * Resolve the `/[store]` route segment (a slug, or `"all"`) to the active scope.
 *
 * The aggregate view — `/all/...`, the default — resolves to "no store filter"
 * without knowing the store list, so it **skips the fetch entirely**. That
 * matters: pages await this before their own query, so on the aggregate view it
 * used to chain two Worker hops (`switcherList` → the list query) in front of
 * every row. A real segment still needs the list to validate the slug.
 */
export const loadStoreScope = cache(async (segment: string) => {
  if (segment === ALL_STORES) {
    return { stores: [] as Store[], scope: resolveStoreScope<Store>([], ALL_STORES) };
  }
  const stores = await loadStores();
  return { stores, scope: resolveStoreScope(stores, segment) };
});
