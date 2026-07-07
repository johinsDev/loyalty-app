"use client";

import { formatRelative } from "@loyalty/date";
import { Skeleton } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import { useTRPC } from "@/lib/trpc/client";

import { PromoStatsChart } from "./promo-stats-chart";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});
const money = (cents: number) => cop.format(Math.round(cents / 100));

/** Per-promo activity for the published/archived detail screen (last 30 days). */
export function PromoStatsBlock({ id }: { id: string }) {
  const t = useTranslations("Promotions.analytics");
  const locale = useLocale();
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.promociones.promoStats.queryOptions({ id }));

  if (isLoading || !data) {
    return <Skeleton className="h-56 rounded-3xl" />;
  }

  const active = data.series.some((p) => p.uses > 0);

  return (
    <div className="bg-card rounded-3xl border p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold tracking-tight">{t("detailTitle")}</h2>
        <span className="text-muted-foreground text-xs font-semibold">
          {data.lastUsedAt
            ? t("lastUsed", { when: formatRelative(new Date(data.lastUsedAt), { locale }) })
            : t("period")}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label={t("statUses")} value={data.totals.uses.toLocaleString("es-CO")} />
        <Kpi label={t("statDiscount")} value={money(data.totals.discountCents)} />
        <Kpi label={t("statRevenue")} value={money(data.totals.revenueCents)} />
        <Kpi label={t("statCustomers")} value={data.totals.customers.toLocaleString("es-CO")} />
      </div>

      {active ? (
        <div className="mt-4">
          <PromoStatsChart series={data.series} label={t("statUses")} />
        </div>
      ) : (
        <p className="text-muted-foreground mt-4 text-sm">{t("empty")}</p>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-2xl p-3">
      <p className="text-muted-foreground text-[11px] font-semibold">{label}</p>
      <p className="font-display mt-0.5 text-lg font-semibold">{value}</p>
    </div>
  );
}
