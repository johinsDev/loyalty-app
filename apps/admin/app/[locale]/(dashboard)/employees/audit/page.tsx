import { setRequestLocale } from "next-intl/server";

import { AuditLogView } from "@/features/employees/components/audit-log-view";

type Props = { params: Promise<{ locale: string }> };

export default async function AuditLogPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AuditLogView />;
}
