import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";

import { DataTableSkeleton, SelectionProvider } from "@/components/data-table";
import { IslandBoundary } from "@/components/island-boundary";
import { IngredientsListHeader } from "@/features/ingredients/components/ingredients-list-header";
import { IngredientsTable } from "@/features/ingredients/components/ingredients-table";
import { IngredientsToolbar } from "@/features/ingredients/components/ingredients-toolbar";
import { INGREDIENTS_FILTER_KEYS } from "@/features/ingredients/list-params";

type Props = {
  params: Promise<{ locale: string; storeId: string }>;
  searchParams: Promise<SearchParams>;
};

function filterKey(sp: SearchParams): string {
  return INGREDIENTS_FILTER_KEYS.map((k) => `${k}:${JSON.stringify(sp[k] ?? null)}`).join("|");
}

/**
 * Ingredients catalog — new route. Ingredients could previously only be created
 * inline from the product editor and never edited, even though the update and
 * remove endpoints already existed. Org-wide, so the `[storeId]` scope is
 * ignored here.
 */
export default function ProductIngredientsPage({ params, searchParams }: Props) {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <IngredientsListHeader />
      {/* `ServerPagination` reads the selection context, so the provider has to
          wrap the table hole even though these lists have no bulk actions yet. */}
      <SelectionProvider>
        <IngredientsToolbar />
        <div className="mt-4">
          <IslandBoundary>
            <Suspense fallback={<DataTableSkeleton columns={5} />}>
              <IngredientsTableSection params={params} searchParams={searchParams} />
            </Suspense>
          </IslandBoundary>
        </div>
      </SelectionProvider>
    </div>
  );
}

async function IngredientsTableSection({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  return (
    <Suspense key={filterKey(sp)} fallback={<DataTableSkeleton columns={5} />}>
      <IngredientsTable searchParams={sp} />
    </Suspense>
  );
}
