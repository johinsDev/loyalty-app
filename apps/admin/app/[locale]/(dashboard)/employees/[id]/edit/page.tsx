import { setRequestLocale } from "next-intl/server";

import { EmployeeWizard } from "@/features/employees/components/employee-wizard";

type Props = { params: Promise<{ locale: string; id: string }> };

/** Edit an existing employee (the wizard, prefilled from the member row). */
export default async function EmployeeEditPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <EmployeeWizard id={id} />;
}
