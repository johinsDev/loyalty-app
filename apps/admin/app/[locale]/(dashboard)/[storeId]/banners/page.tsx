import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";

import { DataTableSkeleton, SelectionProvider } from "@/components/data-table";
import { IslandBoundary } from "@/components/island-boundary";
import { BannerDetailModalMount } from "@/features/banners/components/banner-detail-modal-mount";
import { BannersBulkBar } from "@/features/banners/components/banners-bulk-bar";
import { BannersListHeader } from "@/features/banners/components/banners-list-header";
import { BannersTable } from "@/features/banners/components/banners-table";
import { BannersToolbar } from "@/features/banners/components/banners-toolbar";
import { loadStores, loadStoreScope } from "@/lib/store-scope-server";

type Props = {
  params: Promise<{ locale: string; storeId: string }>;
  searchParams: Promise<SearchParams>;
};

/**
 * Banners list — the shell (header + toolbar) renders synchronously so
 * navigating here never flashes a full-page skeleton; only the server-rendered
 * table streams into its unkeyed `<Suspense>` hole (filtering keeps the current
 * rows through the RSC transition). Store scope from `[storeId]` hard-filters.
 */
export default function BannersPage({ params, searchParams }: Props) {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <BannersListHeader />

      <SelectionProvider>
        <BannersToolbar />
        <div className="mt-4">
          <IslandBoundary>
            <Suspense fallback={<DataTableSkeleton columns={7} />}>
              <BannersTableSection params={params} searchParams={searchParams} />
            </Suspense>
          </IslandBoundary>
        </div>
        <BannersBulkBar />
      </SelectionProvider>

      <BannerDetailModalMount />
    </div>
  );
}

async function BannersTableSection({ params, searchParams }: Props) {
  const [{ locale, storeId: segment }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  // `multiStore` only drives a column, so it rides along with the store list the
  // shell already fetches (`loadStores`, request-deduped) rather than gating the
  // rows on it.
  const [{ scope }, stores] = await Promise.all([loadStoreScope(segment), loadStores()]);
  return (
    <BannersTable
      searchParams={sp}
      storeId={scope?.storeId ?? null}
      multiStore={stores.length >= 2}
    />
  );
}
