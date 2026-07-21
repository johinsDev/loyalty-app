import { setRequestLocale } from "next-intl/server";

import { StoreWizard } from "@/features/stores/components/store-wizard";

type Props = { params: Promise<{ locale: string }> };

export default async function NewStorePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <StoreWizard />;
}
