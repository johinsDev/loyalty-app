import { setRequestLocale } from "next-intl/server";

import { RewardWizard } from "@/features/rewards/components/reward-wizard";

type Props = { params: Promise<{ locale: string }> };

export default async function NewRewardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RewardWizard />;
}
