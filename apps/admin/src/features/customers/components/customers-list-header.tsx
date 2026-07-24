"use client";

import { buttonVariants } from "@loyalty/ui";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/nav";

/**
 * Static list header (title + subtitle + "Add customer"). A client component so
 * the list page can render its shell **synchronously** — nothing above the table
 * awaits, so navigating to the list no longer flashes a full-page skeleton; only
 * the table area streams under its own `<Suspense>`.
 */
export function CustomersListHeader() {
  const t = useTranslations("Customers");
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>
      <Link href="/customers/new" className={buttonVariants({ className: "h-10 gap-1.5 rounded-xl" })}>
        <Plus className="size-4" />
        {t("addCustomer")}
      </Link>
    </div>
  );
}
