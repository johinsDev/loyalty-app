import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";

import { DataTableSkeleton, SelectionProvider } from "@/components/data-table";
import { IslandBoundary } from "@/components/island-boundary";
import { ProductsListHeader } from "@/features/products/components/products-list-header";
import { ProductsTable } from "@/features/products/components/products-table";
import { ProductsToolbar } from "@/features/products/components/products-toolbar";
import { PRODUCTS_FILTER_KEYS } from "@/features/products/list-params";
import { loadStoreScope } from "@/lib/store-scope-server";

type Props = {
  params: Promise<{ locale: string; storeId: string }>;
  searchParams: Promise<SearchParams>;
};

/** Suspense key from just the FILTER params (not page/sort) so the skeleton
 *  re-flashes on a filter change while the new rows stream; pagination/sort keep
 *  the current rows through the RSC transition. */
function filterKey(sp: SearchParams): string {
  return PRODUCTS_FILTER_KEYS.map((k) => `${k}:${JSON.stringify(sp[k] ?? null)}`).join("|");
}

/**
 * Products list — the shell (header + toolbar) renders synchronously so
 * navigating here keeps a static prerendered shell (instant nav); only the
 * server-rendered table streams into its `<Suspense>` hole. Store scope from the
 * `[storeId]` segment scopes the catalog. No top-level `await` — that would
 * de-opt the shell to dynamic (the customers-list bug).
 */
export default function ProductsPage({ params, searchParams }: Props) {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <ProductsListHeader />

      <SelectionProvider>
        <ProductsToolbar />
        <div className="mt-4">
          <IslandBoundary>
            <Suspense fallback={<DataTableSkeleton columns={6} />}>
              <ProductsTableSection params={params} searchParams={searchParams} />
            </Suspense>
          </IslandBoundary>
        </div>
      </SelectionProvider>
    </div>
  );
}

async function ProductsTableSection({ params, searchParams }: Props) {
  const { locale, storeId: segment } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const { scope } = await loadStoreScope(segment);
  return (
    <Suspense key={filterKey(sp)} fallback={<DataTableSkeleton columns={6} />}>
      <ProductsTable searchParams={sp} storeId={scope?.storeId ?? null} />
    </Suspense>
  );
}
