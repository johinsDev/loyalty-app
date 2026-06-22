"use client";

import { Badge, Button } from "@loyalty/ui";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFadeUp } from "@/lib/animate";

import {
  atRisk,
  cohorts,
  dauAvg,
  dauBars,
  engagementMix,
  fraudAlerts,
  impact,
  type Kpi,
  kpis,
  promoPerformance,
  purchasesSeries,
  recentClaims,
  recentPurchases,
  redemptionSeries,
  topCustomers,
} from "../data";
import { AreaChart, Bars, Donut, Sparkline } from "./charts";

const PERIODS = ["24h", "7d", "30d", "90d", "ytd"] as const;

/**
 * Admin dashboard — a faithful build of the t4-admin design: a ROI "Impacto del
 * programa" hero (the SaaS sell), the KPI row, then the analytics grid
 * (purchases, engagement mix, DAU, redemptions, cohorts, promo performance,
 * live purchases, top customers, at-risk, fraud, recent claims). Design-first /
 * hardcoded (../data); RFM mix, cohorts and fraud are flagged Beta. Reveals with
 * the shared staggered fade-up.
 */
export function DashboardView() {
  const t = useTranslations("Dashboard");
  const fade = useFadeUp({ step: 40 });
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("30d");
  let i = 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      {/* Period + export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <Button variant="outline" className="h-10 gap-2 rounded-xl">
          <Download className="size-4" />
          {t("export")}
        </Button>
      </div>

      {/* ROI hero — the sell */}
      <section
        style={fade(i++)}
        className="from-primary to-primary/80 relative mt-5 overflow-hidden rounded-3xl bg-gradient-to-br p-6 text-white shadow-xl"
      >
        <span className="absolute -top-16 -right-10 size-56 rounded-full bg-white/10" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-extrabold tracking-wider">
            <Sparkles className="size-3.5" />
            {t("impactTitle")}
          </span>
          <div className="mt-4 flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <div className="font-display text-5xl font-semibold tracking-tight">
                {impact.revenue}
              </div>
              <div className="mt-1 text-sm font-semibold text-white/85">
                {t("impactRevenue", { delta: impact.delta })}
              </div>
            </div>
            <Stat
              label={t("impactSpend")}
              value={impact.multiple}
              sub={t("vsNonMembers")}
            />
            <Stat
              label={t("impactPlan", { plan: impact.plan })}
              value={impact.planReturn}
              sub={t("impactReturn")}
            />
          </div>
        </div>
      </section>

      {/* KPI row */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.key} kpi={k} style={fade(i++)} />
        ))}
      </div>

      {/* Purchases + engagement */}
      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ChartCard
          title={t("purchasesTitle")}
          subtitle={t("purchasesSubtitle")}
          style={fade(i++)}
          className="lg:col-span-2"
        >
          <div className="h-52">
            <AreaChart series={purchasesSeries} />
          </div>
        </ChartCard>
        <ChartCard title={t("engagementTitle")} beta style={fade(i++)}>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Donut
              slices={engagementMix}
              center="82"
              centerSub={t("scoreOf100Short")}
            />
            <ul className="min-w-40 flex-1 space-y-2 text-sm">
              {engagementMix.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span
                    className="size-2.5 flex-none rounded-full"
                    style={{ background: s.color }}
                  />
                  <span className="flex-1">{t(`mix.${s.key}`)}</span>
                  <span className="font-bold">{s.pct}%</span>
                </li>
              ))}
            </ul>
          </div>
        </ChartCard>
      </div>

      {/* DAU + redemptions */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard
          title={t("dauTitle")}
          subtitle={t("dauSubtitle")}
          badge={t("dauAvg", { n: dauAvg })}
          style={fade(i++)}
        >
          <div className="h-40">
            <Bars series={dauBars} />
          </div>
        </ChartCard>
        <ChartCard
          title={t("redemptionTitle")}
          subtitle={t("redemptionSubtitle")}
          badge="+22.6%"
          style={fade(i++)}
        >
          <div className="h-40">
            <AreaChart series={redemptionSeries} color="#f0a868" />
          </div>
        </ChartCard>
      </div>

      {/* Cohorts + promo performance */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard
          title={t("cohortsTitle")}
          subtitle={t("cohortsSubtitle")}
          beta
          style={fade(i++)}
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
                    <td key={idx} className="p-0.5">
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

        <ChartCard
          title={t("promoPerfTitle")}
          subtitle={t("promoPerfSubtitle")}
          style={fade(i++)}
        >
          <ul className="space-y-3">
            {promoPerformance.map((p) => (
              <li key={p.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-bold">{p.name}</span>
                  <span className="text-muted-foreground font-semibold">
                    {p.reach.toLocaleString()} · {p.rate}%
                  </span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <span
                    className="from-primary to-primary/60 block h-full rounded-full bg-gradient-to-r"
                    style={{ width: `${p.rate}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      {/* Recent purchases + top customers */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title={t("recentPurchasesTitle")} live style={fade(i++)}>
          <ul className="divide-border divide-y">
            {recentPurchases.map((p) => (
              <li
                key={p.name + p.time}
                className="flex items-center gap-3 py-2.5"
              >
                <AvatarChip initials={p.initials} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{p.name}</div>
                  <div className="text-muted-foreground/70 truncate text-xs font-semibold">
                    {p.item} · {p.store}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{p.amount}</div>
                  <div className="text-primary text-xs font-extrabold">
                    {p.points} pts
                  </div>
                </div>
                <span className="text-muted-foreground/70 w-12 text-right text-xs font-semibold">
                  {p.time}
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>

        <ChartCard
          title={t("topCustomersTitle")}
          subtitle={t("topCustomersSubtitle")}
          style={fade(i++)}
        >
          <ul className="divide-border divide-y">
            {topCustomers.map((c, idx) => (
              <li key={c.name} className="flex items-center gap-3 py-2.5">
                <span className="text-muted-foreground/60 w-4 text-sm font-bold">
                  {idx + 1}
                </span>
                <AvatarChip initials={c.initials} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{c.name}</div>
                  <div className="text-muted-foreground/70 text-xs font-semibold">
                    {t("visits", { count: c.visits })}
                  </div>
                </div>
                <span className="text-primary text-sm font-extrabold">
                  {c.ltv}
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      {/* At-risk + fraud + recent claims */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ChartCard
          title={t("atRiskTitle")}
          subtitle={t("atRiskSubtitle")}
          style={fade(i++)}
        >
          <ul className="divide-border divide-y">
            {atRisk.map((c) => (
              <li key={c.name} className="flex items-center gap-3 py-2.5">
                <AvatarChip initials={c.initials} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{c.name}</div>
                  <div className="text-muted-foreground/70 text-xs font-semibold">
                    {t("lastVisitAgo", { ago: c.ago })}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full text-xs"
                >
                  {t("winBack")}
                </Button>
              </li>
            ))}
          </ul>
        </ChartCard>

        <ChartCard
          title={t("fraudTitle")}
          subtitle={t("fraudSubtitle")}
          beta
          style={fade(i++)}
        >
          <ul className="divide-border divide-y">
            {fraudAlerts.map((f) => (
              <li key={f.key} className="flex items-start gap-3 py-2.5">
                <span
                  className={`grid size-9 flex-none place-items-center rounded-xl ${
                    f.severity === "high"
                      ? "bg-rose-500/15 text-rose-500"
                      : "bg-amber-500/15 text-amber-600"
                  }`}
                >
                  <AlertTriangle className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{t(`fraud.${f.key}`)}</span>
                    <Badge
                      variant="secondary"
                      className={`text-[0.625rem] ${f.severity === "high" ? "text-rose-500" : "text-amber-600"}`}
                    >
                      {t(f.severity === "high" ? "sevHigh" : "sevMed")}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground/70 text-xs font-semibold">
                    {f.detail} · {f.meta}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </ChartCard>

        <ChartCard title={t("recentClaimsTitle")} style={fade(i++)}>
          <ul className="divide-border divide-y">
            {recentClaims.map((c) => (
              <li
                key={c.name + c.ago}
                className="flex items-center gap-3 py-2.5"
              >
                <span className="bg-primary/10 grid size-9 flex-none place-items-center rounded-xl text-lg">
                  {c.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{c.name}</div>
                  <div className="text-muted-foreground/70 text-xs font-semibold">
                    {c.by}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{c.pts} pts</div>
                  <div className="text-muted-foreground/70 text-xs font-semibold">
                    {c.ago}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold tracking-wider text-white/70 uppercase">
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="font-display text-2xl font-semibold">{value}</span>
        <span className="text-sm font-semibold text-white/80">{sub}</span>
      </div>
    </div>
  );
}

function KpiCard({ kpi, style }: { kpi: Kpi; style?: React.CSSProperties }) {
  const t = useTranslations("Dashboard");
  const up = kpi.trend === "up";
  return (
    <div
      style={style}
      className="bg-card border-border rounded-3xl border p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-muted-foreground/70 text-xs font-extrabold tracking-wider uppercase">
          {t(`kpi.${kpi.key}`)}
        </span>
        <Sparkline series={kpi.spark} trend={kpi.trend} />
      </div>
      <div className="font-display mt-1 text-3xl font-semibold tracking-tight">
        {kpi.value}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold">
        <span
          className={`inline-flex items-center gap-0.5 ${up ? "text-emerald-600" : "text-rose-500"}`}
        >
          {up ? (
            <ArrowUpRight className="size-3.5" />
          ) : (
            <ArrowDownRight className="size-3.5" />
          )}
          {kpi.delta}
        </span>
        <span className="text-muted-foreground/70">· {t(`kpiSub.${kpi.sub}`)}</span>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  badge,
  beta,
  live,
  className = "",
  style,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  beta?: boolean;
  live?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const t = useTranslations("Dashboard");
  return (
    <div
      style={style}
      className={`bg-card border-border min-w-0 rounded-3xl border p-5 shadow-sm ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              {title}
            </h2>
            {beta ? (
              <Badge
                variant="secondary"
                className="text-[0.625rem] font-bold text-blue-600"
              >
                Beta
              </Badge>
            ) : null}
            {live ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                {t("live")}
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <p className="text-muted-foreground/80 mt-0.5 text-xs font-semibold">
              {subtitle}
            </p>
          ) : null}
        </div>
        {badge ? (
          <span className="bg-primary/10 text-primary rounded-full px-2.5 py-1 text-xs font-extrabold">
            {badge}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function AvatarChip({ initials }: { initials: string }) {
  return (
    <span className="bg-primary/10 text-primary grid size-9 flex-none place-items-center rounded-full text-xs font-bold">
      {initials}
    </span>
  );
}
