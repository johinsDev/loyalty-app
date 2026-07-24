"use client";

import { useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";

import { money } from "@/lib/money";
import { useTRPC } from "@/lib/trpc/client";

/**
 * KPI strip for the customers list — org-level aggregates that don't depend on
 * the URL, so it stays a small client island (react-query) with its own loading
 * state, independent of the server table hole.
 */
export function CustomersKpis() {
  const t = useTranslations("Customers");
  const format = useFormatter();
  const trpc = useTRPC();
  const kpis = useQuery(trpc.customers.adminKpis.queryOptions()).data;

  return (
    <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi label={t("kpi.total")} value={String(kpis?.total ?? 0)} />
      <Kpi label={t("kpi.new30d")} value={String(kpis?.new30d ?? 0)} />
      <Kpi label={t("kpi.active30d")} value={String(kpis?.active30d ?? 0)} />
      <Kpi label={t("kpi.avgLtv")} value={money(format, kpis?.avgLtvCents ?? 0)} />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border-border min-w-0 rounded-3xl border p-5 shadow-sm">
      <span className="text-muted-foreground/70 text-xs font-extrabold tracking-wider uppercase">
        {label}
      </span>
      <div className="font-display mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
