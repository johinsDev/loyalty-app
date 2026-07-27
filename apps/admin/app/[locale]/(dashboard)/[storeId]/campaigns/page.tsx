import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";

import { DataTableSkeleton, SelectionProvider } from "@/components/data-table";
import { CampaignDetailModalMount } from "@/features/campaigns/components/campaign-detail-modal-mount";
import { CampaignsBulkBar } from "@/features/campaigns/components/campaigns-bulk-bar";
import { CampaignsListHeader } from "@/features/campaigns/components/campaigns-list-header";
import { CampaignsTable } from "@/features/campaigns/components/campaigns-table";
import { CampaignsToolbar } from "@/features/campaigns/components/campaigns-toolbar";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
};

/**
 * Campaigns list — the shell (header + toolbar) renders synchronously so
 * navigating here never flashes a full-page skeleton; only the server-rendered
 * table streams into its unkeyed `<Suspense>` hole (filtering keeps the current
 * rows through the RSC transition).
 */
export default function CampaignsPage({ params, searchParams }: Props) {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <CampaignsListHeader />

      <SelectionProvider>
        <CampaignsToolbar />
        <div className="mt-4">
          <Suspense fallback={<DataTableSkeleton columns={8} />}>
            <CampaignsTableSection params={params} searchParams={searchParams} />
          </Suspense>
        </div>
        <CampaignsBulkBar />
      </SelectionProvider>

      <CampaignDetailModalMount />
    </div>
  );
}

async function CampaignsTableSection({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  return <CampaignsTable searchParams={sp} />;
}
