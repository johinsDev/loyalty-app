import { setRequestLocale } from "next-intl/server";

import { CampaignWizard } from "@/features/campaigns/components/campaign-wizard";

type Props = { params: Promise<{ locale: string }> };

export default async function NewCampaignPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CampaignWizard />;
}
