import { setRequestLocale } from "next-intl/server";

import { PromoWizard } from "@/features/promotions/components/promo-wizard";

type Props = { params: Promise<{ locale: string }> };

export default async function NewPromotionPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PromoWizard />;
}
