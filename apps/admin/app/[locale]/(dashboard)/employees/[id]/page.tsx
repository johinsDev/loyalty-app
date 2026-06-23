import { setRequestLocale } from "next-intl/server";

import { EmployeeWizard } from "@/features/employees/components/employee-wizard";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function EmployeePage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <EmployeeWizard id={id} />;
}
