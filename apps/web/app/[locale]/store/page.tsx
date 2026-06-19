import { setRequestLocale } from "next-intl/server";

import { StoreView } from "@/features/store/components/store-view";
import { requireCustomer } from "@/lib/auth-guard";

type Props = { params: Promise<{ locale: string }> };

export default async function StorePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCustomer();
  return <StoreView />;
}
