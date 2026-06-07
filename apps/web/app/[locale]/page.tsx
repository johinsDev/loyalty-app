import { setRequestLocale } from "next-intl/server";

import { Home } from "@/features/home/components/home";
import { requireCustomer } from "@/lib/auth-guard";

type Props = { params: Promise<{ locale: string }> };

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCustomer();
  return <Home />;
}
