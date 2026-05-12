import { setRequestLocale } from "next-intl/server";

import { CardView } from "@/features/card/components/card-view";

type Props = { params: Promise<{ locale: string }> };

export default async function CardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CardView />;
}
