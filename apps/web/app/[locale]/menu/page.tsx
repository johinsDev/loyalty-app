import { setRequestLocale } from "next-intl/server";

import { Menu } from "@/features/menu/components/menu";
import { requireCustomer } from "@/lib/auth-guard";

type Props = { params: Promise<{ locale: string }> };

export default async function MenuPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCustomer();
  return <Menu />;
}
