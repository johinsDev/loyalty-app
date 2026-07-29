import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { IslandBoundary } from "@/components/island-boundary";
import { SectionSkeleton } from "@/components/section-skeleton";
import { EmployeeLeaderboardView } from "@/features/employees/components/employee-leaderboard-view";

type Props = { params: Promise<{ locale: string }> };

/** Team performance leaderboard (manager+; gated by the employees layout). */
export default function EmployeePerformancePage({ params }: Props) {
  return (
    <IslandBoundary>
      <Suspense fallback={<SectionSkeleton />}>
        <EmployeePerformanceSection params={params} />
      </Suspense>
    </IslandBoundary>
  );
}

async function EmployeePerformanceSection({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <EmployeeLeaderboardView />;
}
