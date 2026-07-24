"use client";

import {
  Filter,
  Grid3x3,
  Image,
  Send,
  Sparkles,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { AppRouter } from "@loyalty/api";
import { Skeleton } from "@loyalty/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useFormatter, useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useState } from "react";

import { BannersAnalyticsPanel } from "@/features/banners/components/banners-analytics-panel";
import { CampaignsAnalyticsPanel } from "@/features/campaigns/components/campaigns-analytics-panel";
import { AreaChart, Bars, Donut } from "@/features/dashboard/components/charts";
import { TeamLeaderboardPanel } from "@/features/employees/components/team-leaderboard-panel";
import { PromotionsAnalyticsPanel } from "@/features/promotions/components/promotions-analytics-panel";
import { useFadeUp } from "@/lib/animate";
import { money } from "@/lib/money";
import { useTRPC } from "@/lib/trpc/client";

const PERIODS = ["7d", "30d", "90d"] as const;
type Period = (typeof PERIODS)[number];

const SECTIONS = [
  "overview",
  "campaigns",
  "promotions",
  "team",
  "banners",
  "cohorts",
  "funnel",
] as const;
type Section = (typeof SECTIONS)[number];

const ICON: Record<Section, LucideIcon> = {
  overview: TrendingUp,
  campaigns: Send,
  promotions: Sparkles,
  team: Trophy,
  banners: Image,
  cohorts: Grid3x3,
  funnel: Filter,
};

/**
 * Analytics — growth/retention/funnel hub with a left section nav (overview,
 * cohorts, funnel) and period chips. Reuses the dashboard chart wrappers; the
 * /analytics/cohorts and /analytics/funnel routes deep-link a section via
 * `section`. All sections read real tRPC aggregates (dashboard.*).
 */
type DashOut = inferRouterOutputs<AppRouter>["dashboard"];

export function AnalyticsView({
  section = "overview",
  initialPeriod,
  initialFunnel,
  initialCohorts,
  initialSeries,
  initialTiers,
  initialEngagement,
}: {
  section?: Section;
  initialPeriod?: Period;
  initialFunnel?: DashOut["funnel"];
  initialCohorts?: DashOut["cohorts"];
  initialSeries?: DashOut["series"];
  initialTiers?: DashOut["tiers"];
  initialEngagement?: DashOut["redemptionEngagement"];
}) {
  const t = useTranslations("Analytics");
  const fade = useFadeUp({ step: 40 });
  const [active, setActive] = useState<Section>(section);
  // Period lives in the URL (shareable, back-button works). The section queries
  // are keyed on it, so changing it refetches them (client-side; no server
  // round-trip needed since the data is fetched via react-query).
  const [period, setPeriod] = useQueryState(
    "period",
    parseAsStringLiteral(PERIODS).withDefault("30d").withOptions({ history: "push" }),
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground/80 mt-0.5 text-sm font-semibold">
            {t("subtitle")}
          </p>
        </div>
        <div className="bg-card border-border inline-flex rounded-full border p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => void setPeriod(p)}
              className={`h-8 rounded-full px-4 text-sm font-bold transition-colors ${
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-4">
        {/* Section nav */}
        <nav className="lg:sticky lg:top-6 lg:col-span-1 lg:self-start">
          <div className="flex gap-1 overflow-x-auto lg:flex-col">
            {SECTIONS.map((s) => {
              const Icon = ICON[s];
              const on = active === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setActive(s)}
                  className={`flex h-10 flex-none items-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition-colors ${
                    on
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                  {t(`nav.${s}`)}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Active section */}
        <div className="lg:col-span-3">
          {active === "overview" ? (
            <Overview
              fade={fade}
              period={period}
              initialPeriod={initialPeriod}
              initialSeries={initialSeries}
              initialTiers={initialTiers}
              initialEngagement={initialEngagement}
            />
          ) : active === "campaigns" ? (
            <CampaignsAnalyticsPanel />
          ) : active === "promotions" ? (
            <PromotionsAnalyticsPanel />
          ) : active === "team" ? (
            <TeamLeaderboardPanel />
          ) : active === "banners" ? (
            <BannersAnalyticsPanel />
          ) : active === "cohorts" ? (
            <Cohorts fade={fade} initialCohorts={initialCohorts} />
          ) : (
            <FunnelSection
              fade={fade}
              period={period}
              initialPeriod={initialPeriod}
              initialFunnel={initialFunnel}
            />
          )}
        </div>
      </div>
    </div>
  );
}

type Fade = (index: number) => React.CSSProperties | undefined;

/** Tier key → brand color, mirroring the dashboard's tier donut. */
const TIER_COLORS: Record<string, string> = {
  hoja: "var(--primary)",
  flor: "color-mix(in srgb, var(--primary) 45%, #fff)",
  oro: "#f0a868",
};

function Overview({
  fade,
  period,
  initialPeriod,
  initialSeries,
  initialTiers,
  initialEngagement,
}: {
  fade: Fade;
  period: Period;
  initialPeriod?: Period;
  initialSeries?: DashOut["series"];
  initialTiers?: DashOut["tiers"];
  initialEngagement?: DashOut["redemptionEngagement"];
}) {
  const t = useTranslations("Analytics");
  const format = useFormatter();
  const trpc = useTRPC();
  // Server-prefetched for the initial period (no first-paint flash); tiers are
  // period-independent so they hydrate directly. keepPreviousData keeps period
  // switches smooth.
  const onInitial = period === initialPeriod;

  const seriesQ = useQuery(
    trpc.dashboard.series.queryOptions(
      { period },
      { initialData: onInitial ? initialSeries : undefined, placeholderData: keepPreviousData },
    ),
  );
  const tiersQ = useQuery(
    trpc.dashboard.tiers.queryOptions(undefined, { initialData: initialTiers }),
  );
  const engQ = useQuery(
    trpc.dashboard.redemptionEngagement.queryOptions(
      { period },
      { initialData: onInitial ? initialEngagement : undefined, placeholderData: keepPreviousData },
    ),
  );

  const points = seriesQ.data ?? [];
  const growth = points.map((p) => p.newMembers);
  const revenue = points.map((p) => Math.round(p.revenueCents / 100));
  const redemptions = points.map((p) => p.redemptions);

  const tierTotal = (tiersQ.data?.tiers ?? []).reduce((s, tt) => s + tt.count, 0) || 1;
  const tierMix = (tiersQ.data?.tiers ?? []).map((tt) => ({
    key: tt.key,
    pct: Math.round((tt.count / tierTotal) * 100),
    color: TIER_COLORS[tt.key] ?? "#c7cdd4",
  }));

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <ChartCard
        title={t("growthTitle")}
        subtitle={t("growthSubtitle")}
        style={fade(0)}
      >
        <div className="h-48">
          {seriesQ.isPending ? (
            <Skeleton className="size-full rounded-xl" />
          ) : (
            <AreaChart series={growth} />
          )}
        </div>
      </ChartCard>

      <ChartCard
        title={t("tierTitle")}
        subtitle={t("tierSubtitle")}
        style={fade(1)}
      >
        {tiersQ.isPending ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Donut
              slices={tierMix}
              center={format.number(tierTotal)}
              centerSub={t("stage.members")}
            />
            <ul className="min-w-40 flex-1 space-y-2 text-sm">
              {tierMix.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span
                    className="size-2.5 flex-none rounded-full"
                    style={{ background: s.color }}
                  />
                  <span className="flex-1">{t(`tier.${s.key}`)}</span>
                  <span className="font-bold">{s.pct}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </ChartCard>

      <ChartCard
        title={t("revenueTitle")}
        subtitle={t("revenueSubtitle")}
        style={fade(2)}
      >
        <div className="h-44">
          {seriesQ.isPending ? (
            <Skeleton className="size-full rounded-xl" />
          ) : (
            <Bars series={revenue} />
          )}
        </div>
      </ChartCard>

      <ChartCard
        title={t("engagementTitle")}
        subtitle={t("engagementSubtitle")}
        style={fade(3)}
      >
        {seriesQ.isPending || engQ.isPending ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : (
          <div className="space-y-3">
            <div className="h-28">
              <Bars series={redemptions} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MiniStat
                label={t("redeemRate")}
                value={`${engQ.data?.redeemerRatePct ?? 0}%`}
              />
              <MiniStat
                label={t("discountGranted")}
                value={money(format, engQ.data?.discountCents ?? 0)}
              />
            </div>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-2xl px-3 py-2.5">
      <div className="text-muted-foreground/70 text-xs font-bold">{label}</div>
      <div className="font-display mt-0.5 text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function Cohorts({ fade, initialCohorts }: { fade: Fade; initialCohorts?: DashOut["cohorts"] }) {
  const t = useTranslations("Analytics");
  const trpc = useTRPC();
  const q = useQuery(
    trpc.dashboard.cohorts.queryOptions(undefined, { initialData: initialCohorts }),
  );
  const weeks = q.data?.weeks ?? 5;
  const rows = (q.data?.cohorts ?? []).map((c) => ({
    label: new Date(c.label).toLocaleDateString("es-CO", { day: "numeric", month: "short" }),
    weeks: c.retention,
  }));
  return (
    <ChartCard
      title={t("cohortsTitle")}
      subtitle={t("cohortsSubtitle")}
      style={fade(0)}
    >
      {q.isPending ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground py-4 text-sm font-semibold">{t("noData")}</p>
      ) : (
      <table className="w-full text-center text-xs">
        <thead>
          <tr className="text-muted-foreground/70 font-bold">
            <th className="py-1 text-left font-bold">{t("cohort")}</th>
            {Array.from({ length: weeks }, (_, k) => (
              <th key={`S${k}`} className="py-1 font-bold">
                S{k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="text-muted-foreground py-1 text-left font-bold">
                {row.label}
              </td>
              {row.weeks.map((v, idx) => (
                <td key={`${row.label}-${idx}`} className="p-0.5">
                  {v === null ? (
                    <span className="text-muted-foreground/40">·</span>
                  ) : (
                    <span
                      className="block rounded-md py-1.5 font-bold"
                      style={{
                        background: `color-mix(in srgb, var(--primary) ${Math.round(v * 0.9)}%, transparent)`,
                        color: v > 55 ? "#fff" : "var(--foreground)",
                      }}
                    >
                      {v}%
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </ChartCard>
  );
}

function FunnelSection({
  fade,
  period,
  initialPeriod,
  initialFunnel,
}: {
  fade: Fade;
  period: Period;
  initialPeriod?: Period;
  initialFunnel?: DashOut["funnel"];
}) {
  const t = useTranslations("Analytics");
  const trpc = useTRPC();
  const q = useQuery(
    trpc.dashboard.funnel.queryOptions(
      { period },
      {
        // Server-prefetched for the initial period (no first-paint flash), and
        // keepPreviousData so switching period doesn't flash a skeleton.
        initialData: period === initialPeriod ? initialFunnel : undefined,
        placeholderData: keepPreviousData,
      },
    ),
  );
  const stages = q.data?.stages ?? [];
  const max = stages[0]?.value ?? 1;
  return (
    <ChartCard
      title={t("funnelTitle")}
      subtitle={t("funnelSubtitle")}
      style={fade(0)}
    >
      {q.isPending ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
      <ul className="space-y-4">
        {stages.map((stage, idx) => {
          const prev = idx === 0 ? null : stages[idx - 1];
          const drop =
            prev && prev.value > 0
              ? Math.round((1 - stage.value / prev.value) * 100)
              : null;
          return (
            <li key={stage.key}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-bold">{t(`stage.${stage.key}`)}</span>
                <span className="text-muted-foreground font-semibold">
                  {stage.value.toLocaleString()}
                  {drop !== null ? (
                    <span className="text-rose-500"> · -{drop}%</span>
                  ) : null}
                </span>
              </div>
              <div className="bg-muted h-3 overflow-hidden rounded-full">
                <span
                  className="from-primary to-primary/60 block h-full rounded-full bg-gradient-to-r"
                  style={{ width: `${(stage.value / max) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      )}
    </ChartCard>
  );
}

function ChartCard({
  title,
  subtitle,
  style,
  children,
}: {
  title: string;
  subtitle?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      style={style}
      className="bg-card min-w-0 rounded-3xl border p-5 shadow-sm"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-muted-foreground/80 mt-0.5 text-xs font-semibold">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}
