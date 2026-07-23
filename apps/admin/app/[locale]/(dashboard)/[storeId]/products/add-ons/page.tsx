import { setRequestLocale } from "next-intl/server";

import { AddonsView } from "@/features/products/components/addons-view";

type Props = { params: Promise<{ locale: string }> };

export default async function ProductAddonsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AddonsView />;
}
