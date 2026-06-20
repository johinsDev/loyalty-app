import { setRequestLocale } from "next-intl/server";

import { MenuView } from "@/features/cashier/components/menu-view";

type Props = { params: Promise<{ locale: string }> };

export default async function MenuPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MenuView />;
}
