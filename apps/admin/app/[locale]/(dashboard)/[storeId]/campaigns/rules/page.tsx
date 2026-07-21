import { setRequestLocale } from "next-intl/server";

import { SmartDeliveryRules } from "@/features/campaigns/components/smart-delivery-rules";

type Props = { params: Promise<{ locale: string }> };

export default async function CampaignRulesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SmartDeliveryRules />;
}
