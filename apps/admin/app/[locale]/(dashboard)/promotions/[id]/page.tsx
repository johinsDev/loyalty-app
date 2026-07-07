import { setRequestLocale } from "next-intl/server";

import { PromoEditor } from "@/features/promotions/components/promo-editor";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function PromotionPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <PromoEditor id={id} />;
}
