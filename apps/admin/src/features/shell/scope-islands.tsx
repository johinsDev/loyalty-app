import { CashierButton } from "@/components/cashier-button";
import { StoreSwitcher } from "@/components/store-switcher";
import { StoreScopeSeedProvider } from "@/lib/store-scope";
import { loadStoreScope } from "@/lib/store-scope-server";

/**
 * RSC hole for the top-bar store-scoped islands. `await`s the org store list
 * (`[storeId]` param → dynamic, so this only renders inside the layout's
 * `<Suspense>`) and seeds it into {@link StoreScopeSeedProvider}, so the client
 * {@link StoreSwitcher} + {@link CashierButton} resolve the active scope on their
 * first render — correct label + cashier `storeId` with no flash, no duplicate
 * client fetch. `loadStoreScope` is `cache()`-deduped with the page's own read.
 */
export async function ScopeIslands({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { stores } = await loadStoreScope(storeId);
  return (
    <StoreScopeSeedProvider stores={stores}>
      <StoreSwitcher />
      <CashierButton />
    </StoreScopeSeedProvider>
  );
}
