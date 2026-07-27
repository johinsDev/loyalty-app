"use client";

import { buttonVariants } from "@loyalty/ui";
import { Plus, SlidersHorizontal, Zap } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/nav";

/** Static list header (title + subtitle + automated/rules/add links). Client so
 *  the list page renders its shell synchronously — only the table streams. */
export function CampaignsListHeader() {
  const t = useTranslations("Campaigns");
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/campaigns/automated"
          className={buttonVariants({ variant: "outline", className: "h-10 gap-1.5 rounded-xl" })}
        >
          <Zap className="size-4" />
          {t("automatedTitle")}
        </Link>
        <Link
          href="/campaigns/rules"
          className={buttonVariants({ variant: "outline", className: "h-10 gap-1.5 rounded-xl" })}
        >
          <SlidersHorizontal className="size-4" />
          {t("rulesTitle")}
        </Link>
        <Link
          href="/campaigns/new"
          className={buttonVariants({ className: "h-10 gap-1.5 rounded-xl" })}
        >
          <Plus className="size-4" />
          {t("add")}
        </Link>
      </div>
    </div>
  );
}
