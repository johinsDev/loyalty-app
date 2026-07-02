"use client";

import { cn, Skeleton } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

import { CampaignStatsChart } from "./campaign-stats-chart";

const PERIODS = ["7d", "30d", "90d"] as const;
type Period = (typeof PERIODS)[number];

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/**
 * Org-level campaign performance for the Analytics "Campañas" section: period
 * KPIs, an honest sent/clicked/redeemed trend, a per-channel breakdown, and a
 * campaign leaderboard. Backed by `campaigns.analytics` (real ledger data).
 */
export function CampaignsAnalyticsPanel() {
  const t = useTranslations("Campaigns");
  const trpc = useTRPC();
  const [period, setPeriod] = useState<Period>("30d");
  const { data, isLoading } = useQuery(
    trpc.campaigns.analytics.queryOptions({ period }),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={cn(
              "h-8 rounded-full border px-3 text-xs font-semibold transition-colors",
              period === p
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {t(`analytics.period.${p}`)}
          </button>
        ))}
      </div>

      {isLoading || !data ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {["a", "b", "c", "d"].map((k) => (
              <Skeleton key={k} className="h-20 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-56 rounded-3xl" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label={t("analytics.kpiSent")} value={data.kpis.sent.toLocaleString()} />
            <Kpi label={t("analytics.kpiClickRate")} value={pct(data.kpis.clickRate)} />
            <Kpi label={t("analytics.kpiRedeemed")} value={data.kpis.redeemed.toLocaleString()} />
            <Kpi label={t("analytics.kpiActive")} value={data.kpis.active.toLocaleString()} />
          </div>

          <div className="bg-card rounded-3xl border p-5 shadow-sm">
            <h2 className="font-display mb-3 text-lg font-semibold tracking-tight">
              {t("analytics.trendTitle")}
            </h2>
            {data.series.some((p) => p.sent || p.clicked || p.redeemed) ? (
              <CampaignStatsChart
                series={data.series}
                labels={{
                  sent: t("funnel.sent"),
                  clicked: t("funnel.clicked"),
                  redeemed: t("funnel.redeemed"),
                }}
              />
            ) : (
              <p className="text-muted-foreground text-sm">{t("analytics.empty")}</p>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="bg-card rounded-3xl border p-5 shadow-sm">
              <h2 className="font-display mb-3 text-lg font-semibold tracking-tight">
                {t("byChannelTitle")}
              </h2>
              <ChannelBars byChannel={data.byChannel} label={(c) => t(`channel.${c}`)} />
            </div>

            <div className="bg-card rounded-3xl border p-5 shadow-sm">
              <h2 className="font-display mb-3 text-lg font-semibold tracking-tight">
                {t("analytics.leaderboard")}
              </h2>
              {data.leaderboard.length > 0 ? (
                <div className="divide-border divide-y text-sm">
                  {data.leaderboard.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-3 py-2.5">
                      <span className="text-muted-foreground w-5 text-center font-bold">{i + 1}</span>
                      <p className="min-w-0 flex-1 truncate font-semibold">{c.name}</p>
                      <div className="text-muted-foreground grid grid-cols-3 gap-3 text-right text-xs font-semibold">
                        <span>{c.sent.toLocaleString()}</span>
                        <span className="text-foreground">{pct(c.clickRate)}</span>
                        <span>{c.redeemed.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">{t("analytics.empty")}</p>
              )}
            </div>
          </div>
        </>
      )}
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

function ChannelBars({
  byChannel,
  label,
}: {
  byChannel: Record<string, number>;
  label: (c: string) => string;
}) {
  const entries = Object.entries(byChannel).sort(([, a], [, b]) => b - a);
  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">—</p>;
  }
  const total = entries.reduce((s, [, n]) => s + n, 0);
  return (
    <div className="space-y-1.5">
      {entries.map(([ch, n]) => (
        <div key={ch} className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground w-20 shrink-0">{label(ch)}</span>
          <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${total > 0 ? (n / total) * 100 : 0}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right font-semibold">{n}</span>
        </div>
      ))}
    </div>
  );
}
