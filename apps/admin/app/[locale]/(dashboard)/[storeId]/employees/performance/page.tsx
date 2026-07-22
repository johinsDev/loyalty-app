import { setRequestLocale } from "next-intl/server";

import { EmployeeLeaderboardView } from "@/features/employees/components/employee-leaderboard-view";

type Props = { params: Promise<{ locale: string }> };

/** Team performance leaderboard (manager+; gated by the employees layout). */
export default async function EmployeePerformancePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <EmployeeLeaderboardView />;
}
