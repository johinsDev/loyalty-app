import { setRequestLocale } from "next-intl/server";

import { ComingSoon } from "@/components/coming-soon";

type Props = { params: Promise<{ locale: string }> };

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ComingSoon titleKey="cohorts" />;
}
