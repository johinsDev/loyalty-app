"use client";

import { buttonVariants } from "@loyalty/ui";
import { ScrollText, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmployeeInviteButton } from "@/features/employees/components/employee-invite-button";
import { Link } from "@/i18n/nav";

/** Static list header (title + subtitle + leaderboard/audit links + owner-only
 *  invite island). Client so the list page renders its shell synchronously —
 *  only the table streams under Suspense. */
export function EmployeesListHeader() {
  const t = useTranslations("Employees");
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/employees/performance"
          className={buttonVariants({ variant: "outline", className: "h-10 gap-1.5 rounded-xl" })}
        >
          <Trophy className="size-4" />
          {t("leaderboard.link")}
        </Link>
        <Link
          href="/employees/audit"
          className={buttonVariants({ variant: "outline", className: "h-10 gap-1.5 rounded-xl" })}
        >
          <ScrollText className="size-4" />
          {t("auditLink")}
        </Link>
        <EmployeeInviteButton />
      </div>
    </div>
  );
}
