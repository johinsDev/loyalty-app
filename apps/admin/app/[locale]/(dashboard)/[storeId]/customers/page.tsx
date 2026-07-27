import { Skeleton } from "@loyalty/ui";
import { Suspense } from "react";

import { DataTableSkeleton } from "@/components/data-table";
import { CustomersKpis } from "@/features/customers/components/customers-kpis";
import { CustomersListHeader } from "@/features/customers/components/customers-list-header";
import { CustomersView } from "@/features/customers/components/customers-view";

/**
 * Customers list. Mirrors the purchases page: the header renders synchronously
 * (a client component reading i18n from the provider) so the page produces a
 * **static prerendered shell** under `cacheComponents`, and the KPI strip + the
 * table each stream into their own `<Suspense>` hole.
 *
 * The Suspense boundaries are load-bearing, not cosmetic. The client islands
 * read the URL via nuqs (`useSearchParams`); a `useSearchParams` read *without*
 * a Suspense boundary opts the entire route into dynamic rendering — which makes
 * it un-prefetchable, so every navigation here was a live RSC round-trip (~1.2s
 * of held old-page). With the shell static, Next prefetches it into the Router
 * Cache and navigating here is an instant cache hit (like the purchases list),
 * with the data streaming in behind the skeletons. No top-level `await` — that
 * too would de-opt the shell to dynamic.
 */
export default function CustomersPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <CustomersListHeader />

      <div className="mt-5">
        <Suspense
          fallback={
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {["a", "b", "c", "d"].map((k) => (
                <Skeleton key={k} className="h-24 rounded-3xl" />
              ))}
            </div>
          }
        >
          <CustomersKpis />
        </Suspense>
      </div>

      <div className="mt-4">
        <Suspense fallback={<DataTableSkeleton columns={7} />}>
          <CustomersView />
        </Suspense>
      </div>
    </div>
  );
}
