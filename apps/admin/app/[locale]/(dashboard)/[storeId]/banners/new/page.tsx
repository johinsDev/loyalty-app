import { setRequestLocale } from "next-intl/server";

import { BannerWizard } from "@/features/banners/components/banner-wizard";

type Props = { params: Promise<{ locale: string }> };

export default async function NewBannerPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BannerWizard />;
}
