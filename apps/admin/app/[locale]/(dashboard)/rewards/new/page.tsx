import { setRequestLocale } from "next-intl/server";

import { RewardGallery } from "@/features/rewards/components/reward-gallery";

type Props = { params: Promise<{ locale: string }> };

export default async function NewRewardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RewardGallery />;
}
