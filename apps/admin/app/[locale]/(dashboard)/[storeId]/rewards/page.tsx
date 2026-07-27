import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";

import { DataTableSkeleton, SelectionProvider } from "@/components/data-table";
import { RewardsListHeader } from "@/features/rewards/components/rewards-list-header";
import { RewardsTable } from "@/features/rewards/components/rewards-table";
import { RewardsToolbar } from "@/features/rewards/components/rewards-toolbar";
import { loadStoreScope } from "@/lib/store-scope-server";

type Props = {
  params: Promise<{ locale: string; storeId: string }>;
  searchParams: Promise<SearchParams>;
};

/**
 * Rewards list — the shell (header + toolbar) renders synchronously so
 * navigating here never flashes a full-page skeleton; only the server-rendered
 * table streams into its unkeyed `<Suspense>` hole (filtering keeps the current
 * rows through the RSC transition). Store scope from `[storeId]` hard-filters.
 */
export default function RewardsPage({ params, searchParams }: Props) {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <RewardsListHeader />

      <SelectionProvider>
        <RewardsToolbar />
        <div className="mt-4">
          <Suspense fallback={<DataTableSkeleton columns={7} />}>
            <RewardsTableSection params={params} searchParams={searchParams} />
          </Suspense>
        </div>
      </SelectionProvider>
    </div>
  );
}

async function RewardsTableSection({ params, searchParams }: Props) {
  const { locale, storeId: segment } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const { scope } = await loadStoreScope(segment);
  return <RewardsTable searchParams={sp} storeId={scope?.storeId ?? null} />;
}
