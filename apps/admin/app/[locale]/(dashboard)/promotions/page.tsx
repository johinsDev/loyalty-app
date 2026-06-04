import { setRequestLocale } from "next-intl/server";

import { PromoListView } from "@/features/promotions/components/promo-list-view";

type Props = { params: Promise<{ locale: string }> };

export default async function PromotionsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="p-6">
      <PromoListView />
    </div>
  );
}
