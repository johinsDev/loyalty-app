"use client";

import { useTranslations } from "next-intl";

/** Static list header (title + subtitle). Client so the list page renders its
 *  shell synchronously — only the KPI strip + table stream under Suspense. */
export function PurchasesListHeader() {
  const t = useTranslations("Purchases");
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
    </div>
  );
}
