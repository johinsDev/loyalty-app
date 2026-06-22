import { setRequestLocale } from "next-intl/server";

import { CampaignsView } from "@/features/campaigns/components/campaigns-view";

type Props = { params: Promise<{ locale: string }> };

export default async function CampaignsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CampaignsView />;
}
