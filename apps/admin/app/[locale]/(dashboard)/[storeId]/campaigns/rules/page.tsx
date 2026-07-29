import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { IslandBoundary } from "@/components/island-boundary";
import { SectionSkeleton } from "@/components/section-skeleton";
import { SmartDeliveryRules } from "@/features/campaigns/components/smart-delivery-rules";

type Props = { params: Promise<{ locale: string }> };

export default function CampaignRulesPage({ params }: Props) {
  return (
    <IslandBoundary>
      <Suspense fallback={<SectionSkeleton />}>
        <CampaignRulesSection params={params} />
      </Suspense>
    </IslandBoundary>
  );
}

async function CampaignRulesSection({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SmartDeliveryRules />;
}
