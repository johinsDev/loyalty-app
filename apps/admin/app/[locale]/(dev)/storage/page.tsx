import { setRequestLocale } from "next-intl/server";

import { StorageDevPage } from "@/features/storage/components/dev-page";

type Props = { params: Promise<{ locale: string }> };

export default async function StorageSmokePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <StorageDevPage />;
}
