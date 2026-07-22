import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { EmployeeActivityView } from "@/features/employees/components/employee-activity-view";
import { trpc } from "@/lib/trpc/server";

type Props = { params: Promise<{ locale: string; id: string }> };

/** Full per-employee activity timeline (auth events + loyalty events). */
export default async function EmployeeActivityPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const api = await trpc();
  const detail = await api.employees.get({ memberId: id }).catch(() => null);
  if (!detail) notFound();

  return (
    <EmployeeActivityView memberId={id} name={detail.name ?? detail.email ?? "—"} />
  );
}
