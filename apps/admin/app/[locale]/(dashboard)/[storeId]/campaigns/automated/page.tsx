import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { IslandBoundary } from "@/components/island-boundary";
import { SectionSkeleton } from "@/components/section-skeleton";
import { AutomatedTriggers } from "@/features/campaigns/components/automated-triggers";

type Props = { params: Promise<{ locale: string }> };

export default function CampaignAutomatedPage({ params }: Props) {
  return (
    <IslandBoundary>
      <Suspense fallback={<SectionSkeleton />}>
        <CampaignAutomatedSection params={params} />
      </Suspense>
    </IslandBoundary>
  );
}

async function CampaignAutomatedSection({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AutomatedTriggers />;
}
