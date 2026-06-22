import { setRequestLocale } from "next-intl/server";

import { StoresView } from "@/features/stores/components/stores-view";

type Props = { params: Promise<{ locale: string }> };

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <StoresView />;
}
