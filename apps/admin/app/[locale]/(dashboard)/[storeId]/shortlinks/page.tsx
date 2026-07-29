import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { IslandBoundary } from "@/components/island-boundary";
import { SectionSkeleton } from "@/components/section-skeleton";
import { ShortlinksView } from "@/features/shortlinks/components/shortlinks-view";

type Props = { params: Promise<{ locale: string }> };

export default function ShortlinksPage({ params }: Props) {
  return (
    <IslandBoundary>
      <Suspense fallback={<SectionSkeleton />}>
        <ShortlinksSection params={params} />
      </Suspense>
    </IslandBoundary>
  );
}

async function ShortlinksSection({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ShortlinksView />;
}
