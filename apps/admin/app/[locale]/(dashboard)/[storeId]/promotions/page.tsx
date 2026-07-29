import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";

import { DataTableSkeleton, SelectionProvider } from "@/components/data-table";
import { IslandBoundary } from "@/components/island-boundary";
import { PromotionsListHeader } from "@/features/promotions/components/promotions-list-header";
import { PromotionsTable } from "@/features/promotions/components/promotions-table";
import { PromotionsToolbar } from "@/features/promotions/components/promotions-toolbar";
import { loadStoreScope } from "@/lib/store-scope-server";

type Props = {
  params: Promise<{ locale: string; storeId: string }>;
  searchParams: Promise<SearchParams>;
};

/**
 * Promotions list — the shell (header + toolbar) renders synchronously so
 * navigating here never flashes a full-page skeleton; only the server-rendered
 * table streams into its unkeyed `<Suspense>` hole (filtering keeps the current
 * rows through the RSC transition). Store scope from `[storeId]` scopes it.
 */
export default function PromotionsPage({ params, searchParams }: Props) {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <PromotionsListHeader />

      <SelectionProvider>
        <PromotionsToolbar />
        <div className="mt-4">
          <IslandBoundary>
            <Suspense fallback={<DataTableSkeleton columns={9} />}>
              <PromotionsTableSection params={params} searchParams={searchParams} />
            </Suspense>
          </IslandBoundary>
        </div>
      </SelectionProvider>
    </div>
  );
}

async function PromotionsTableSection({ params, searchParams }: Props) {
  const { locale, storeId: segment } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const { scope } = await loadStoreScope(segment);
  return <PromotionsTable searchParams={sp} storeId={scope?.storeId ?? null} />;
}
