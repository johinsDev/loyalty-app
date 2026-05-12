import { setRequestLocale } from "next-intl/server";

import { DashboardView } from "@/features/dashboard/components/dashboard-view";

type Props = { params: Promise<{ locale: string }> };

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DashboardView />;
}
