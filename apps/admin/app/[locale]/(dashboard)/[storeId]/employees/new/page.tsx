import { setRequestLocale } from "next-intl/server";

import { EmployeeWizard } from "@/features/employees/components/employee-wizard";

type Props = { params: Promise<{ locale: string }> };

export default async function NewEmployeePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <EmployeeWizard />;
}
