import { buttonVariants } from "@loyalty/ui";
import { Plus } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";

import { DataTableSkeleton, SelectionProvider } from "@/components/data-table";
import { RewardsTable } from "@/features/rewards/components/rewards-table";
import { RewardsToolbar } from "@/features/rewards/components/rewards-toolbar";
import { loadRewardsSearchParams } from "@/features/rewards/list-params";
import { Link } from "@/i18n/nav";
import { loadStoreScope } from "@/lib/store-scope-server";

type Props = {
  params: Promise<{ locale: string; storeId: string }>;
  searchParams: Promise<SearchParams>;
};

/**
 * Rewards list — the static shell (header + Add button) with the server-rendered
 * table streaming into a `<Suspense>` hole. The Suspense `key` is the
 * filter/search slice of the URL, so filtering re-shows the skeleton while
 * pagination/sort keep the current rows during the RSC navigation. Store scope
 * from the `[storeId]` segment hard-filters the query.
 */
export default async function RewardsPage({ params, searchParams }: Props) {
  const { locale, storeId: segment } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Rewards");
  const sp = await searchParams;
  const { scope } = await loadStoreScope(segment);
  const storeId = scope?.storeId ?? null;

  const v = loadRewardsSearchParams(sp);
  const filterKey = JSON.stringify({
    q: v.q,
    status: v.status,
    type: v.type,
    view: v.view,
    storeId,
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <Link href="/rewards/new" className={buttonVariants({ className: "h-10 gap-1.5 rounded-xl" })}>
          <Plus className="size-4" />
          {t("add")}
        </Link>
      </div>

      <SelectionProvider>
        <RewardsToolbar />
        <div className="mt-4">
          <Suspense key={filterKey} fallback={<DataTableSkeleton columns={7} />}>
            <RewardsTable searchParams={sp} storeId={storeId} />
          </Suspense>
        </div>
      </SelectionProvider>
    </div>
  );
}
