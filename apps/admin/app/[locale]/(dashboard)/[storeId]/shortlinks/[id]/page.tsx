import { setRequestLocale } from "next-intl/server";

import { ShortlinkDetail } from "@/features/shortlinks/components/shortlink-detail";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function ShortlinkDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <ShortlinkDetail id={id} />;
}
