import { Skeleton } from "@loyalty/ui";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";

import { DataTableSkeleton, SelectionProvider } from "@/components/data-table";
import { PurchasesBulkBar } from "@/features/purchases/components/purchases-bulk-bar";
import { PurchasesKpis } from "@/features/purchases/components/purchases-kpis";
import { PurchasesTable } from "@/features/purchases/components/purchases-table";
import { PurchasesToolbar } from "@/features/purchases/components/purchases-toolbar";
import { loadPurchasesSearchParams } from "@/features/purchases/list-params";
import { loadStoreScope } from "@/lib/store-scope-server";

type Props = {
  params: Promise<{ locale: string; storeId: string }>;
  searchParams: Promise<SearchParams>;
};

/**
 * Purchases list — static shell (header) with the KPI strip and the table each
 * streaming into their own `<Suspense>` hole (both honor the active filters, so
 * both are keyed on the filter slice). Store scope from the `[storeId]` segment
 * hard-filters both.
 */
export default async function PurchasesPage({ params, searchParams }: Props) {
  const { locale, storeId: segment } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Purchases");
  const sp = await searchParams;
  const { scope } = await loadStoreScope(segment);
  const storeId = scope?.storeId ?? null;

  const v = loadPurchasesSearchParams(sp);
  const filterKey = JSON.stringify({
    q: v.q,
    store: v.store,
    cashier: v.cashier,
    effectiveness: v.effectiveness,
    currency: v.currency,
    entry: v.entry,
    customer: v.customer,
    amountMin: v.amountMin,
    amountMax: v.amountMax,
    from: v.from,
    to: v.to,
    view: v.view,
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      <div className="mt-5">
        <Suspense
          key={filterKey}
          fallback={
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-24 rounded-3xl" />
              ))}
            </div>
          }
        >
          <PurchasesKpis searchParams={sp} storeId={storeId} />
        </Suspense>
      </div>

      <SelectionProvider>
        <PurchasesToolbar />
        <div className="mt-4">
          <Suspense key={filterKey} fallback={<DataTableSkeleton columns={11} />}>
            <PurchasesTable searchParams={sp} storeId={storeId} />
          </Suspense>
        </div>
        <PurchasesBulkBar />
      </SelectionProvider>
    </div>
  );
}
