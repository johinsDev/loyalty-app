import { setRequestLocale } from "next-intl/server";

import { PromoWizard } from "@/features/promotions/components/promo-wizard";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function PromotionPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PromoWizard id={id} />
    </div>
  );
}
