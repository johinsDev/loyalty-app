import { setRequestLocale } from "next-intl/server";

import { PromoWizard } from "@/features/promotions/components/promo-wizard";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function PromotionPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <PromoWizard id={id} />;
}
