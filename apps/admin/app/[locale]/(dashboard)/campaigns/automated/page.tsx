import { setRequestLocale } from "next-intl/server";

import { AutomatedTriggers } from "@/features/campaigns/components/automated-triggers";

type Props = { params: Promise<{ locale: string }> };

export default async function CampaignAutomatedPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AutomatedTriggers />;
}
