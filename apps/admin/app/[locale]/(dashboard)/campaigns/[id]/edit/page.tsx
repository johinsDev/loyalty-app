import { setRequestLocale } from "next-intl/server";

import { CampaignWizard } from "@/features/campaigns/components/campaign-wizard";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function EditCampaignPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <CampaignWizard id={id} />;
}
