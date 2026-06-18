import { setRequestLocale } from "next-intl/server";

import { QrView } from "@/features/qr/components/qr-view";
import { requireCustomer } from "@/lib/auth-guard";

type Props = { params: Promise<{ locale: string }> };

export default async function QrPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCustomer();
  return <QrView />;
}
