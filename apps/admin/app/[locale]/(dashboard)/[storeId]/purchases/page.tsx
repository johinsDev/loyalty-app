import { Skeleton } from "@loyalty/ui";
import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";

import { DataTableSkeleton, SelectionProvider } from "@/components/data-table";
import { IslandBoundary } from "@/components/island-boundary";
import { PurchasesBulkBar } from "@/features/purchases/components/purchases-bulk-bar";
import { PurchasesKpis } from "@/features/purchases/components/purchases-kpis";
import { PurchasesListHeader } from "@/features/purchases/components/purchases-list-header";
import { PurchasesTable } from "@/features/purchases/components/purchases-table";
import { PurchasesToolbar } from "@/features/purchases/components/purchases-toolbar";
import { PURCHASE_FILTER_KEYS } from "@/features/purchases/list-params";
import { loadStoreScope } from "@/lib/store-scope-server";

type Props = {
  params: Promise<{ locale: string; storeId: string }>;
  searchParams: Promise<SearchParams>;
};

const KpisSkeleton = (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {["a", "b", "c", "d"].map((k) => (
      <Skeleton key={k} className="h-24 rounded-3xl" />
    ))}
  </div>
);

/**
 * A Suspense key built from just the FILTER params (not page/sort). Each section
 * resolves `searchParams`, computes this key, and wraps its data-fetching child
 * in a `<Suspense key={filterKey}>`. Because the key is produced during the
 * *server* render, a filter change remounts the boundary with a genuinely
 * unresolved child, so it re-suspends and the skeleton re-appears while the new
 * rows stream — the effect nuqs' router transition otherwise suppresses (it
 * keeps a revealed boundary mounted). Pagination/sort stay out of the key, so
 * their transition keeps the current rows (smooth, no flash).
 */
function filterKey(sp: SearchParams): string {
  return PURCHASE_FILTER_KEYS.map((k) => `${k}:${JSON.stringify(sp[k] ?? null)}`).join("|");
}

/**
 * Purchases list — the shell (header + toolbar) renders synchronously so the
 * route keeps a static prerendered shell (instant navigation); the KPI strip and
 * the table each stream into their own `<Suspense>` hole. The outer holes give
 * the shell + first-load skeleton; an inner `filterKey`-keyed hole re-flashes the
 * skeleton on every filter change (see {@link filterKey}). Store scope from the
 * `[storeId]` segment hard-filters both.
 */
export default function PurchasesPage({ params, searchParams }: Props) {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <PurchasesListHeader />

      <div className="mt-5">
        <IslandBoundary>
          <Suspense fallback={KpisSkeleton}>
            <PurchasesKpisSection params={params} searchParams={searchParams} />
          </Suspense>
        </IslandBoundary>
      </div>

      <SelectionProvider>
        <PurchasesToolbar />
        <div className="mt-4">
          <IslandBoundary>
            <Suspense fallback={<DataTableSkeleton columns={11} />}>
              <PurchasesTableSection params={params} searchParams={searchParams} />
            </Suspense>
          </IslandBoundary>
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
  const sp = await searchParams;
  return (
    <Suspense key={filterKey(sp)} fallback={KpisSkeleton}>
      <PurchasesKpisData params={params} sp={sp} />
    </Suspense>
  );
}

async function PurchasesKpisData({ params, sp }: { params: Props["params"]; sp: SearchParams }) {
  const storeId = await resolveStoreId(params);
  return <PurchasesKpis searchParams={sp} storeId={storeId} />;
}

async function PurchasesTableSection({ params, searchParams }: Props) {
  const sp = await searchParams;
  return (
    <Suspense key={filterKey(sp)} fallback={<DataTableSkeleton columns={11} />}>
      <PurchasesTableData params={params} sp={sp} />
    </Suspense>
  );
}

async function PurchasesTableData({ params, sp }: { params: Props["params"]; sp: SearchParams }) {
  const storeId = await resolveStoreId(params);
  return <PurchasesTable searchParams={sp} storeId={storeId} />;
}
