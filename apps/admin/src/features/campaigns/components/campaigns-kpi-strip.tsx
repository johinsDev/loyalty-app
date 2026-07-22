"use client";

import { Skeleton } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Send } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/**
 * Compact real campaign KPIs for the dashboard (last 30 days): enviados, tasa de
 * clic, canjes, activas — with a link into the Analytics Campañas section.
 * Real `campaigns.analytics` data living beside the dashboard's demo cards.
 */
export function CampaignsKpiStrip() {
  const t = useTranslations("Campaigns");
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(
    trpc.campaigns.analytics.queryOptions({ period: "30d" }),
  );

  return (
    <div className="bg-card border-border rounded-3xl border p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Send className="text-primary size-4" />
          {t("title")}
          <span className="text-muted-foreground text-xs font-medium">· 30 días</span>
        </h2>
        <Link
          href="/analytics"
          className="text-primary inline-flex items-center gap-1 text-xs font-semibold hover:underline"
        >
          {t("analytics.detailTrend")}
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
          <Kpi label={t("analytics.kpiSent")} value={data.kpis.sent.toLocaleString()} />
          <Kpi label={t("analytics.kpiClickRate")} value={pct(data.kpis.clickRate)} />
          <Kpi label={t("analytics.kpiRedeemed")} value={data.kpis.redeemed.toLocaleString()} />
          <Kpi label={t("analytics.kpiActive")} value={data.kpis.active.toLocaleString()} />
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
