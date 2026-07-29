import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { IslandBoundary } from "@/components/island-boundary";
import { SectionSkeleton } from "@/components/section-skeleton";
import { ShortlinkDetail } from "@/features/shortlinks/components/shortlink-detail";

type Props = { params: Promise<{ locale: string; id: string }> };

export default function ShortlinkDetailPage({ params }: Props) {
  return (
    <IslandBoundary>
      <Suspense fallback={<SectionSkeleton />}>
        <ShortlinkDetailSection params={params} />
      </Suspense>
    </IslandBoundary>
  );
}

async function ShortlinkDetailSection({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <ShortlinkDetail id={id} />;
}
