import { setRequestLocale } from "next-intl/server";

import { RewardWizard } from "@/features/rewards/components/reward-wizard";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function EditRewardPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <RewardWizard id={id} />;
}
