"use client";

import { Skeleton } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/lib/trpc/client";

import { BannerStatsChart } from "./banner-stats-chart";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/**
 * Org-level banner performance for the Analytics "Banners" section: totals,
 * an impressions/clicks trend, and the top banners by impressions/CTR. Backed by
 * `banners.analytics` (real DB daily counters), not the hardcoded demo data.
 */
export function BannersAnalyticsPanel() {
  const t = useTranslations("Banners");
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.banners.analytics.queryOptions({}));

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
        <Kpi label={t("statImpressions")} value={data.totals.impressions.toLocaleString()} />
        <Kpi label={t("statClicks")} value={data.totals.clicks.toLocaleString()} />
        <Kpi label={t("statCtr")} value={pct(data.totals.ctr)} />
        <Kpi label={t("statBanners")} value={data.totals.banners.toLocaleString()} />
      </div>

      <div className="bg-card rounded-3xl border p-5 shadow-sm">
        <h2 className="font-display mb-3 text-lg font-semibold tracking-tight">{t("statsTitle")}</h2>
        {data.series.length > 0 ? (
          <BannerStatsChart
            series={data.series}
            labels={{ impressions: t("statImpressions"), clicks: t("statClicks") }}
          />
        ) : (
          <p className="text-muted-foreground text-sm">{t("statsEmpty")}</p>
        )}
      </div>

      <div className="bg-card rounded-3xl border p-5 shadow-sm">
        <h2 className="font-display mb-3 text-lg font-semibold tracking-tight">{t("topBanners")}</h2>
        {data.top.length > 0 ? (
          <div className="divide-border divide-y text-sm">
            {data.top.map((b, i) => (
              <div key={b.id} className="flex items-center gap-3 py-2.5">
                <span className="text-muted-foreground w-5 text-center font-bold">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{b.name}</p>
                  <p className="text-muted-foreground font-mono text-xs">/{b.slug}</p>
                </div>
                <div className="text-muted-foreground grid grid-cols-3 gap-4 text-right text-xs font-semibold">
                  <span>
                    {b.impressions.toLocaleString()}
                    <span className="block text-[10px] font-bold uppercase">{t("statImpressions")}</span>
                  </span>
                  <span>
                    {b.clicks.toLocaleString()}
                    <span className="block text-[10px] font-bold uppercase">{t("statClicks")}</span>
                  </span>
                  <span className="text-foreground">
                    {pct(b.ctr)}
                    <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                      {t("statCtr")}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{t("statsEmpty")}</p>
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
