import { setRequestLocale } from "next-intl/server";

import { BannerWizard } from "@/features/banners/components/banner-wizard";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function EditBannerPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <BannerWizard id={id} />;
}
