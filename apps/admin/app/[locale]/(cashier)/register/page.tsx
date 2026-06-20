import { setRequestLocale } from "next-intl/server";

import { ScanView } from "@/features/cashier/components/scan-view";

type Props = { params: Promise<{ locale: string }> };

/** Escanear tab — the earn loop. Role guard lives in the (cashier) layout. */
export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ScanView />;
}
