import { setRequestLocale } from "next-intl/server";

import { PromoGallery } from "@/features/promotions/components/promo-gallery";

type Props = { params: Promise<{ locale: string }> };

export default async function NewPromotionPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PromoGallery />;
}
