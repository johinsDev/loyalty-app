import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LoyaltyView } from "@/features/settings/components/loyalty-view";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Settings" });
  return { title: t("loyalty.title") };
}

/** Loyalty rules as a first-level destination — core business config (mode,
 *  points equivalence, insights), promoted out of Ajustes. */
export default async function LoyaltyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-6 lg:px-8">
      <LoyaltyView />
    </div>
  );
}
