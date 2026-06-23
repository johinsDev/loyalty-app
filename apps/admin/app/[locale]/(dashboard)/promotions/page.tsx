import { setRequestLocale } from "next-intl/server";

import { PromotionsView } from "@/features/promotions/components/promotions-view";

type Props = { params: Promise<{ locale: string }> };

export default async function PromotionsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PromotionsView />;
}
