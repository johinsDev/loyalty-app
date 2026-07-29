import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";

import { DataTableSkeleton, SelectionProvider } from "@/components/data-table";
import { IslandBoundary } from "@/components/island-boundary";
import { AddonsListHeader } from "@/features/addons/components/addons-list-header";
import { AddonsTable } from "@/features/addons/components/addons-table";
import { AddonsToolbar } from "@/features/addons/components/addons-toolbar";
import { ADDONS_FILTER_KEYS } from "@/features/addons/list-params";

type Props = {
  params: Promise<{ locale: string; storeId: string }>;
  searchParams: Promise<SearchParams>;
};

/** Suspense key from just the FILTER params (not page/sort) so the skeleton
 *  re-flashes on a filter change while the new rows stream; pagination/sort
 *  keep the current rows through the RSC transition. */
function filterKey(sp: SearchParams): string {
  return ADDONS_FILTER_KEYS.map((k) => `${k}:${JSON.stringify(sp[k] ?? null)}`).join("|");
}

/**
 * Add-ons catalog — the shell (header + toolbar) renders synchronously so
 * navigating here keeps a prerendered shell; only the server-rendered table
 * streams into its `<Suspense>` hole. No top-level `await`, which would de-opt
 * the shell to dynamic. The catalog is org-wide, so unlike products this route
 * ignores the `[storeId]` scope.
 */
export default function ProductAddonsPage({ params, searchParams }: Props) {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <AddonsListHeader />
      {/* `ServerPagination` reads the selection context, so the provider has to
          wrap the table hole even though these lists have no bulk actions yet. */}
      <SelectionProvider>
        <AddonsToolbar />
        <div className="mt-4">
          <IslandBoundary>
            <Suspense fallback={<DataTableSkeleton columns={6} />}>
              <AddonsTableSection params={params} searchParams={searchParams} />
            </Suspense>
          </IslandBoundary>
        </div>
      </SelectionProvider>
    </div>
  );
}

async function AddonsTableSection({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  return (
    <Suspense key={filterKey(sp)} fallback={<DataTableSkeleton columns={6} />}>
      <AddonsTable searchParams={sp} />
    </Suspense>
  );
}
