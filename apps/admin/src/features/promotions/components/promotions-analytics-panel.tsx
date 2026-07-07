"use client";

import { Skeleton } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

import { PromoMoneyChart } from "./promo-money-chart";
import { PromoStatsChart } from "./promo-stats-chart";
import { PromoWeekdayChart } from "./promo-weekday-chart";

// Monday-first display order over the 0=Sun…6=Sat weekday buckets.
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const WEEKDAY_KEY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

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
  const td = useTranslations("Promotions.day");
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="bg-card rounded-3xl border p-5 shadow-sm">
          <h2 className="font-display mb-1 text-lg font-semibold tracking-tight">
            {t("weekdayTitle")}
          </h2>
          <p className="text-muted-foreground mb-3 text-xs font-semibold">{t("weekdaySubtitle")}</p>
          {data.totals.uses > 0 ? (
            <PromoWeekdayChart
              label={t("statUses")}
              data={WEEKDAY_ORDER.map((i) => ({
                label: td(WEEKDAY_KEY[i]),
                uses: data.byWeekday.find((w) => w.weekday === i)?.uses ?? 0,
              }))}
            />
          ) : (
            <p className="text-muted-foreground text-sm">{t("empty")}</p>
          )}
        </div>

        <div className="bg-card rounded-3xl border p-5 shadow-sm">
          <h2 className="font-display mb-1 text-lg font-semibold tracking-tight">
            {t("moneyTitle")}
          </h2>
          <p className="text-muted-foreground mb-3 text-xs font-semibold">{t("moneySubtitle")}</p>
          {data.series.some((p) => p.uses > 0) ? (
            <PromoMoneyChart
              series={data.series}
              labels={{ revenue: t("statRevenue"), discount: t("statDiscount") }}
            />
          ) : (
            <p className="text-muted-foreground text-sm">{t("empty")}</p>
          )}
        </div>
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
