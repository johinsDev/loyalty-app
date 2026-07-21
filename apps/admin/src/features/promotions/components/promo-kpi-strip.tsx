"use client";

import { Skeleton } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});
const money = (cents: number) => cop.format(Math.round(cents / 100));

/**
 * Compact real promo KPIs for the dashboard's prominent stats band (last 30
 * days): usos, descuento entregado, ventas con promo, clientes — with a link
 * into the Analytics Promociones section. Mirrors CampaignsKpiStrip.
 */
export function PromoKpiStrip() {
  const t = useTranslations("Promotions.analytics");
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.promociones.analytics.queryOptions({}));

  return (
    <div className="bg-card border-border rounded-3xl border p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Sparkles className="text-primary size-4" />
          {t("stripTitle")}
          <span className="text-muted-foreground text-xs font-medium">· 30 días</span>
        </h2>
        <Link
          href="/analytics/promotions"
          className="text-primary inline-flex items-center gap-1 text-xs font-semibold hover:underline"
        >
          {t("viewAll")}
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
      {isLoading || !data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {["a", "b", "c", "d"].map((k) => (
            <Skeleton key={k} className="h-14 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label={t("statUses")} value={data.totals.uses.toLocaleString("es-CO")} />
          <Kpi label={t("statDiscount")} value={money(data.totals.discountCents)} />
          <Kpi label={t("statRevenue")} value={money(data.totals.revenueCents)} />
          <Kpi label={t("statCustomers")} value={data.totals.customers.toLocaleString("es-CO")} />
        </div>
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
