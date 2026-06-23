import { setRequestLocale } from "next-intl/server";

import { StoreForm } from "@/features/stores/components/store-form";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function StorePage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <StoreForm id={id} />;
}
