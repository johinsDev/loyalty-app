import { setRequestLocale } from "next-intl/server";

import { SettingsView } from "@/features/settings/components/settings-view";

type Props = { params: Promise<{ locale: string }> };

export default async function SettingsTeamPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SettingsView section="team" />;
}
