import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { IslandBoundary } from "@/components/island-boundary";
import { SectionSkeleton } from "@/components/section-skeleton";
import { SettingsView } from "@/features/settings/components/settings-view";

type Props = { params: Promise<{ locale: string }> };

export default function SettingsIntegrationsPage({ params }: Props) {
  return (
    <IslandBoundary>
      <Suspense fallback={<SectionSkeleton />}>
        <SettingsIntegrationsSection params={params} />
      </Suspense>
    </IslandBoundary>
  );
}

async function SettingsIntegrationsSection({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SettingsView section="integrations" />;
}
