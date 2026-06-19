import { setRequestLocale } from "next-intl/server";

import { Promos } from "@/features/promos/components/promos";
import { requireCustomer } from "@/lib/auth-guard";

type Props = { params: Promise<{ locale: string }> };

export default async function PromosPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCustomer();
  return <Promos />;
}
