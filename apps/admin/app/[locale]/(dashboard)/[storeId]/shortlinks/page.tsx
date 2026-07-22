import { setRequestLocale } from "next-intl/server";

import { ShortlinksView } from "@/features/shortlinks/components/shortlinks-view";

type Props = { params: Promise<{ locale: string }> };

export default async function ShortlinksPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ShortlinksView />;
}
