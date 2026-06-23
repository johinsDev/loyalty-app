import { setRequestLocale } from "next-intl/server";

import { StoreForm } from "@/features/stores/components/store-form";

type Props = { params: Promise<{ locale: string }> };

export default async function NewStorePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <StoreForm />;
}
