"use client";

import { Badge } from "@loyalty/ui";
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
import { useTranslations } from "next-intl";
import { useState } from "react";

import { BannersAnalyticsPanel } from "@/features/banners/components/banners-analytics-panel";
import { CampaignsAnalyticsPanel } from "@/features/campaigns/components/campaigns-analytics-panel";
import { AreaChart, Bars, Donut } from "@/features/dashboard/components/charts";
import { TeamLeaderboardPanel } from "@/features/employees/components/team-leaderboard-panel";
import { PromotionsAnalyticsPanel } from "@/features/promotions/components/promotions-analytics-panel";
import { useFadeUp } from "@/lib/animate";

import {
  cohorts,
  engagementClick,
  engagementOpen,
  funnel,
  growthSeries,
  revenueBars,
  tierMix,
} from "../data";

const PERIODS = ["24h", "7d", "30d", "90d", "ytd"] as const;

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
 * `section`. Design-first / hardcoded (../data).
 */
export function AnalyticsView({ section = "overview" }: { section?: Section }) {
  const t = useTranslations("Analytics");
  const fade = useFadeUp({ step: 40 });
  const [active, setActive] = useState<Section>(section);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("30d");

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
              onClick={() => setPeriod(p)}
              className={`h-8 rounded-full px-4 text-sm font-bold transition-colors ${
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "ytd" ? t("ytd") : p}
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
            <Overview fade={fade} />
          ) : active === "campaigns" ? (
            <CampaignsAnalyticsPanel />
          ) : active === "promotions" ? (
            <PromotionsAnalyticsPanel />
          ) : active === "team" ? (
            <TeamLeaderboardPanel />
          ) : active === "banners" ? (
            <BannersAnalyticsPanel />
          ) : active === "cohorts" ? (
            <Cohorts fade={fade} />
          ) : (
            <FunnelSection fade={fade} />
          )}
        </div>
      </div>
    </div>
  );
}

type Fade = (index: number) => React.CSSProperties | undefined;

function Overview({ fade }: { fade: Fade }) {
  const t = useTranslations("Analytics");
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <ChartCard
        title={t("growthTitle")}
        subtitle={t("growthSubtitle")}
        style={fade(0)}
      >
        <div className="h-48">
          <AreaChart series={growthSeries} />
        </div>
      </ChartCard>

      <ChartCard
        title={t("tierTitle")}
        subtitle={t("tierSubtitle")}
        style={fade(1)}
      >
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Donut slices={tierMix} center="4" centerSub={t("nav.overview")} />
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
      </ChartCard>

      <ChartCard
        title={t("revenueTitle")}
        subtitle={t("revenueSubtitle")}
        style={fade(2)}
      >
        <div className="h-44">
          <Bars series={revenueBars} />
        </div>
      </ChartCard>

      <ChartCard
        title={t("engagementTitle")}
        subtitle={t("engagementSubtitle")}
        style={fade(3)}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-muted-foreground/70 mb-1 flex items-center gap-1.5 text-xs font-bold">
              <span className="bg-primary size-2 rounded-full" />
              {t("open")}
            </div>
            <div className="h-32">
              <Bars series={engagementOpen} />
            </div>
          </div>
          <div>
            <div className="text-muted-foreground/70 mb-1 flex items-center gap-1.5 text-xs font-bold">
              <span className="bg-primary/50 size-2 rounded-full" />
              {t("click")}
            </div>
            <div className="h-32">
              <Bars series={engagementClick} />
            </div>
          </div>
        </div>
      </ChartCard>
    </div>
  );
}

function Cohorts({ fade }: { fade: Fade }) {
  const t = useTranslations("Analytics");
  return (
    <ChartCard
      title={t("cohortsTitle")}
      subtitle={t("cohortsSubtitle")}
      style={fade(0)}
    >
      <table className="w-full text-center text-xs">
        <thead>
          <tr className="text-muted-foreground/70 font-bold">
            <th className="py-1 text-left font-bold">{t("cohort")}</th>
            {["S0", "S1", "S2", "S3", "S4"].map((w) => (
              <th key={w} className="py-1 font-bold">
                {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((row) => (
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
    </ChartCard>
  );
}

function FunnelSection({ fade }: { fade: Fade }) {
  const t = useTranslations("Analytics");
  const max = funnel[0]?.value ?? 1;
  return (
    <ChartCard
      title={t("funnelTitle")}
      subtitle={t("funnelSubtitle")}
      style={fade(0)}
    >
      <ul className="space-y-4">
        {funnel.map((stage, idx) => {
          const prev = idx === 0 ? null : funnel[idx - 1];
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
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              {title}
            </h2>
            <Badge
              variant="secondary"
              className="text-[0.625rem] font-bold text-blue-600"
            >
              Beta
            </Badge>
          </div>
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
