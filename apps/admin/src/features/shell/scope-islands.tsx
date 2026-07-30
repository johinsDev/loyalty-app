import { CashierButton } from "@/components/cashier-button";
import { StoreSwitcher } from "@/components/store-switcher";
import { StoreScopeSeedProvider } from "@/lib/store-scope";
import { loadStores } from "@/lib/store-scope-server";

/**
 * RSC hole for the top-bar store-scoped islands. `await`s the org store list
 * (`[storeId]` param → dynamic, so this only renders inside the layout's
 * `<Suspense>`) and seeds it into {@link StoreScopeSeedProvider}, so the client
 * {@link StoreSwitcher} + {@link CashierButton} resolve the active scope on their
 * first render — correct label + cashier `storeId` with no flash, no duplicate
 * client fetch. `loadStores` is `cache()`-deduped with any scoped page read.
 *
 * This island owns the store-list fetch: pages resolve their scope without it on
 * `/all/...`, so the switcher's data never sits in front of their rows.
 */
export async function ScopeIslands({ params }: { params: Promise<{ storeId: string }> }) {
  await params;
  const stores = await loadStores();
  return (
    <StoreScopeSeedProvider stores={stores}>
      <StoreSwitcher />
      <CashierButton />
    </StoreScopeSeedProvider>
  );
}
