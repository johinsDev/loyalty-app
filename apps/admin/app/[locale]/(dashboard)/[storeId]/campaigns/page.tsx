import { buttonVariants } from "@loyalty/ui";
import { Plus, SlidersHorizontal, Zap } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";

import { DataTableSkeleton, SelectionProvider } from "@/components/data-table";
import { CampaignDetailModalMount } from "@/features/campaigns/components/campaign-detail-modal-mount";
import { CampaignsBulkBar } from "@/features/campaigns/components/campaigns-bulk-bar";
import { CampaignsTable } from "@/features/campaigns/components/campaigns-table";
import { CampaignsToolbar } from "@/features/campaigns/components/campaigns-toolbar";
import { loadCampaignsSearchParams } from "@/features/campaigns/list-params";
import { Link } from "@/i18n/nav";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
};

/**
 * Campaigns list — the static shell (header + "Add"/"Automated"/"Rules") with
 * the server-rendered table streaming into a `<Suspense>` hole. The Suspense
 * `key` is the filter/search slice of the URL, so filtering re-shows the
 * skeleton while pagination/sort keep the current rows during the RSC
 * navigation.
 */
export default async function CampaignsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Campaigns");
  const sp = await searchParams;

  const v = loadCampaignsSearchParams(sp);
  const filterKey = JSON.stringify({
    q: v.q,
    type: v.type,
    state: v.state,
    from: v.from,
    to: v.to,
    view: v.view,
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/campaigns/automated"
            className={buttonVariants({ variant: "outline", className: "h-10 gap-1.5 rounded-xl" })}
          >
            <Zap className="size-4" />
            {t("automatedTitle")}
          </Link>
          <Link
            href="/campaigns/rules"
            className={buttonVariants({ variant: "outline", className: "h-10 gap-1.5 rounded-xl" })}
          >
            <SlidersHorizontal className="size-4" />
            {t("rulesTitle")}
          </Link>
          <Link
            href="/campaigns/new"
            className={buttonVariants({ className: "h-10 gap-1.5 rounded-xl" })}
          >
            <Plus className="size-4" />
            {t("add")}
          </Link>
        </div>
      </div>

      <SelectionProvider>
        <CampaignsToolbar />
        <div className="mt-4">
          <Suspense key={filterKey} fallback={<DataTableSkeleton columns={8} />}>
            <CampaignsTable searchParams={sp} />
          </Suspense>
        </div>
        <CampaignsBulkBar />
      </SelectionProvider>

      <CampaignDetailModalMount />
    </div>
  );
}
