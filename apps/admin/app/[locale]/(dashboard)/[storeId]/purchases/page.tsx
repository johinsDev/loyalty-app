import { Skeleton } from "@loyalty/ui";
import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";

import { DataTableSkeleton, SelectionProvider } from "@/components/data-table";
import { PurchasesBulkBar } from "@/features/purchases/components/purchases-bulk-bar";
import { PurchasesKpis } from "@/features/purchases/components/purchases-kpis";
import { PurchasesListHeader } from "@/features/purchases/components/purchases-list-header";
import { PurchasesTable } from "@/features/purchases/components/purchases-table";
import { PurchasesToolbar } from "@/features/purchases/components/purchases-toolbar";
import { loadStoreScope } from "@/lib/store-scope-server";

type Props = {
  params: Promise<{ locale: string; storeId: string }>;
  searchParams: Promise<SearchParams>;
};

/**
 * Purchases list — the shell (header + toolbar) renders synchronously so
 * navigating here never flashes a full-page skeleton; the KPI strip and the
 * table each stream into their own unkeyed `<Suspense>` hole (both honor the
 * active filters). Store scope from the `[storeId]` segment hard-filters both.
 */
export default function PurchasesPage({ params, searchParams }: Props) {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <PurchasesListHeader />

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
          <PurchasesKpisSection params={params} searchParams={searchParams} />
        </Suspense>
      </div>

      <SelectionProvider>
        <PurchasesToolbar />
        <div className="mt-4">
          <Suspense fallback={<DataTableSkeleton columns={11} />}>
            <PurchasesTableSection params={params} searchParams={searchParams} />
          </Suspense>
        </div>
        <PurchasesBulkBar />
      </SelectionProvider>
    </div>
  );
}

/** Resolve the `[storeId]` segment → real store id (or null for aggregate).
 *  `loadStoreScope` is request-cached, so the KPI + table sections share it. */
async function resolveStoreId(params: Props["params"]): Promise<string | null> {
  const { locale, storeId: segment } = await params;
  setRequestLocale(locale);
  const { scope } = await loadStoreScope(segment);
  return scope?.storeId ?? null;
}

async function PurchasesKpisSection({ params, searchParams }: Props) {
  const storeId = await resolveStoreId(params);
  const sp = await searchParams;
  return <PurchasesKpis searchParams={sp} storeId={storeId} />;
}

async function PurchasesTableSection({ params, searchParams }: Props) {
  const storeId = await resolveStoreId(params);
  const sp = await searchParams;
  return <PurchasesTable searchParams={sp} storeId={storeId} />;
}
