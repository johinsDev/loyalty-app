import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { IslandBoundary } from "@/components/island-boundary";
import { SectionSkeleton } from "@/components/section-skeleton";
import { AuditLogView } from "@/features/employees/components/audit-log-view";

type Props = { params: Promise<{ locale: string }> };

export default function AuditLogPage({ params }: Props) {
  return (
    <IslandBoundary>
      <Suspense fallback={<SectionSkeleton />}>
        <AuditLogSection params={params} />
      </Suspense>
    </IslandBoundary>
  );
}

async function AuditLogSection({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AuditLogView />;
}
