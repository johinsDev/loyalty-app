import { setRequestLocale } from "next-intl/server";

import { TemplatesView } from "@/features/templates/components/templates-view";

type Props = { params: Promise<{ locale: string }> };

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TemplatesView />;
}
