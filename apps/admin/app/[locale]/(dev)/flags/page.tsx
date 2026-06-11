import { setRequestLocale } from "next-intl/server";

import { FlagsSmoke } from "@/features/flags/components/flags-smoke";

type Props = { params: Promise<{ locale: string }> };

export default async function FlagsSmokePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <FlagsSmoke />;
}
