import { setRequestLocale } from "next-intl/server";

import { RewardsView } from "@/features/cashier/components/rewards-view";

type Props = { params: Promise<{ locale: string }> };

export default async function RewardsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RewardsView />;
}
