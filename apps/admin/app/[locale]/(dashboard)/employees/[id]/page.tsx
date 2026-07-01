import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { EmployeeDetailView } from "@/features/employees/components/employee-detail-view";
import { Link } from "@/i18n/navigation";
import { trpc } from "@/lib/trpc/server";

type Props = { params: Promise<{ locale: string; id: string }> };

/** Full employee detail page — rendered on direct load / reload / share. In-app
 *  navigation from the list intercepts this as a modal instead. */
export default async function EmployeeDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const api = await trpc();
  const detail = await api.employees.get({ memberId: id }).catch(() => null);
  if (!detail) notFound();

  const t = await getTranslations({ locale, namespace: "Employees" });

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <Link
        href="/employees"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-bold"
      >
        <ArrowLeft className="size-4" />
        {t("title")}
      </Link>
      <div className="mt-2">
        <EmployeeDetailView detail={detail} variant="page" />
      </div>
    </div>
  );
}
