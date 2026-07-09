import { setRequestLocale } from "next-intl/server";

import { RewardEditor } from "@/features/rewards/components/reward-editor";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function RewardPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <RewardEditor id={id} />;
}
