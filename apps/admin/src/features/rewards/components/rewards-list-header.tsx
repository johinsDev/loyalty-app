"use client";

import { buttonVariants } from "@loyalty/ui";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/nav";

/** Static list header (title + subtitle + "Add"). Client so the list page
 *  renders its shell synchronously — only the table streams under Suspense. */
export function RewardsListHeader() {
  const t = useTranslations("Rewards");
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>
      <Link href="/rewards/new" className={buttonVariants({ className: "h-10 gap-1.5 rounded-xl" })}>
        <Plus className="size-4" />
        {t("add")}
      </Link>
    </div>
  );
}
