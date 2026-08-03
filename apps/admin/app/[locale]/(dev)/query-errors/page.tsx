import { setRequestLocale } from "next-intl/server";

import { QueryErrorSmoke } from "@/features/dev/components/query-error-smoke";

type Props = { params: Promise<{ locale: string }> };

export default async function QueryErrorsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <QueryErrorSmoke />;
}
