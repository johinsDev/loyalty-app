import { setRequestLocale } from "next-intl/server";

import { StoreWizard } from "@/features/stores/components/store-wizard";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function StorePage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <StoreWizard id={id} />;
}
