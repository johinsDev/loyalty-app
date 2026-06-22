import { setRequestLocale } from "next-intl/server";

import { EmployeesView } from "@/features/employees/components/employees-view";

type Props = { params: Promise<{ locale: string }> };

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <EmployeesView />;
}
