import { setRequestLocale } from "next-intl/server";

import { AnalyticsView } from "@/features/analytics/components/analytics-view";

type Props = { params: Promise<{ locale: string }> };

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AnalyticsView section="cohorts" />;
}
