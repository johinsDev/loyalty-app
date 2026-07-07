"use client";

import { Skeleton } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

import { PromoStatsChart } from "./promo-stats-chart";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});
const money = (cents: number) => cop.format(Math.round(cents / 100));

/**
 * Org-level promo activity for the Analytics "Promociones" section: uses,
 * discount given, revenue on promo tickets, unique redeemers, a daily-uses
 * trend, and the top promos by usage. Real data from `promotions.analytics`.
 * These are activity + cost metrics, not incrementality — a promo auto-applies
 * at checkout (no view event), so there's no CTR-style funnel.
 */
export function PromotionsAnalyticsPanel() {
  const t = useTranslations("Promotions.analytics");
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.promociones.analytics.queryOptions({}));

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {["a", "b", "c", "d"].map((k) => (
            <Skeleton key={k} className="h-20 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label={t("statUses")} value={data.totals.uses.toLocaleString("es-CO")} />
        <Kpi label={t("statDiscount")} value={money(data.totals.discountCents)} />
        <Kpi label={t("statRevenue")} value={money(data.totals.revenueCents)} />
        <Kpi label={t("statCustomers")} value={data.totals.customers.toLocaleString("es-CO")} />
      </div>

      <div className="bg-card rounded-3xl border p-5 shadow-sm">
        <h2 className="font-display mb-1 text-lg font-semibold tracking-tight">{t("trendTitle")}</h2>
        <p className="text-muted-foreground mb-3 text-xs font-semibold">{t("trendSubtitle")}</p>
        {data.series.some((p) => p.uses > 0) ? (
          <PromoStatsChart series={data.series} label={t("statUses")} />
        ) : (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        )}
      </div>

      <div className="bg-card rounded-3xl border p-5 shadow-sm">
        <h2 className="font-display mb-3 text-lg font-semibold tracking-tight">{t("topTitle")}</h2>
        {data.top.length > 0 ? (
          <div className="divide-border divide-y text-sm">
            {data.top.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 py-2.5">
                <span className="text-muted-foreground w-5 text-center font-bold">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={{ pathname: "/promotions/[id]", params: { id: p.id } }}
                    className="truncate font-semibold hover:underline"
                  >
                    {p.name || t("untitled")}
                  </Link>
                </div>
                <div className="text-muted-foreground grid grid-cols-3 gap-4 text-right text-xs font-semibold">
                  <span>
                    {p.uses.toLocaleString("es-CO")}
                    <span className="block text-[10px] font-bold uppercase">{t("statUses")}</span>
                  </span>
                  <span className="text-foreground">
                    {money(p.discountCents)}
                    <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                      {t("statDiscount")}
                    </span>
                  </span>
                  <span>
                    {p.customers.toLocaleString("es-CO")}
                    <span className="block text-[10px] font-bold uppercase">{t("statCustomers")}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-2xl border p-3">
      <p className="text-muted-foreground text-xs font-semibold">{label}</p>
      <p className="font-display mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
