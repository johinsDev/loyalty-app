import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { IslandBoundary } from "@/components/island-boundary";
import { SectionSkeleton } from "@/components/section-skeleton";
import { SettingsView } from "@/features/settings/components/settings-view";

type Props = { params: Promise<{ locale: string }> };

/** Static shell → the client settings view streams into the Suspense hole
 *  (behind an IslandBoundary). `setRequestLocale` lives in the nested async
 *  section so nothing is awaited at the page top (keeps the route prerenderable). */
export default function SettingsPage({ params }: Props) {
  return (
    <IslandBoundary>
      <Suspense fallback={<SectionSkeleton />}>
        <SettingsSection params={params} />
      </Suspense>
    </IslandBoundary>
  );
}

async function SettingsSection({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SettingsView />;
}
