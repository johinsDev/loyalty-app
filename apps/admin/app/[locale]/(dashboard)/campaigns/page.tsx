import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";

import { CampaignsView } from "@/features/campaigns/components/campaigns-view";
import { buildCampaignsInput, loadCampaignsSearchParams } from "@/features/campaigns/list-params";
import { trpc } from "@/lib/trpc/server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
};

/** RSC: prefetch the first page (from the URL searchParams) so the list paints
 *  server-rendered; the client then drives refetching via nuqs + react-query. */
export default async function CampaignsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const input = buildCampaignsInput(await loadCampaignsSearchParams(searchParams));
  let initialData:
    | Awaited<ReturnType<Awaited<ReturnType<typeof trpc>>["campaigns"]["adminList"]>>
    | undefined;
  try {
    const api = await trpc();
    initialData = await api.campaigns.adminList(input);
  } catch {
    initialData = undefined;
  }

  return <CampaignsView initialData={initialData} />;
}
