import { setRequestLocale } from "next-intl/server";

import { PurchasesView } from "@/features/cashier/components/purchases-view";

type Props = { params: Promise<{ locale: string }> };

export default async function PurchasesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PurchasesView />;
}
