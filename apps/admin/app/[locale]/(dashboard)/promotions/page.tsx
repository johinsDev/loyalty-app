import { getTranslations, setRequestLocale } from "next-intl/server";

import { PromoWizard } from "@/features/promotions/components/promo-wizard";

type Props = { params: Promise<{ locale: string }> };

export default async function PromotionsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Promotions" });

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <PromoWizard />
    </div>
  );
}
