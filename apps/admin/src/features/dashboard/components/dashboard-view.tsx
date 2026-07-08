"use client";

import { Badge, Button, Skeleton } from "@loyalty/ui";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { CampaignsKpiStrip } from "@/features/campaigns/components/campaigns-kpi-strip";
import { DashboardPromoCard } from "@/features/promotions/components/dashboard-promo-card";
import { PromoKpiStrip } from "@/features/promotions/components/promo-kpi-strip";
import { useFadeUp } from "@/lib/animate";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";

import { cohorts, dauAvg, dauBars, fraudAlerts, impact, type Kpi } from "../data";
import { AreaChart, Bars, Donut, Sparkline } from "./charts";

const PERIODS = ["7d", "30d", "90d"] as const;
type Period = (typeof PERIODS)[number];

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});
const fmtCop = (cents: number) => COP.format(Math.round(cents) / 100);
const fmtNum = (n: number) => new Intl.NumberFormat("es-CO").format(n);
const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "·";
const agoOf = (d: Date, now: number): string => {
  const min = Math.max(0, Math.round((now - new Date(d).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} d`;
};
const deltaStr = (pct: number | null): { delta: string; trend: "up" | "down" } =>
  pct == null
    ? { delta: "—", trend: "up" }
    : { delta: `${pct >= 0 ? "+" : ""}${pct}%`, trend: pct >= 0 ? "up" : "down" };

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
  const trpc = useTRPC();
  const [period, setPeriod] = useState<Period>("30d");
  let i = 0;

  const overview = useQuery(trpc.dashboard.overview.queryOptions({ period }));
  const seriesQ = useQuery(trpc.dashboard.series.queryOptions({ period }));
  const recentPurchasesQ = useQuery(trpc.dashboard.recentPurchases.queryOptions({ limit: 6 }));
  const recentRedemptionsQ = useQuery(trpc.dashboard.recentRedemptions.queryOptions({ limit: 6 }));
  const topCustomersQ = useQuery(trpc.dashboard.topCustomers.queryOptions({ period, limit: 6 }));
  const atRiskQ = useQuery(trpc.dashboard.atRisk.queryOptions({ days: 30, limit: 5 }));
  const retentionQ = useQuery(trpc.dashboard.retention.queryOptions({ period }));
  const engagementQ = useQuery(trpc.dashboard.redemptionEngagement.queryOptions({ period }));
  const tiersQ = useQuery(trpc.dashboard.tiers.queryOptions());
  const liabilityQ = useQuery(trpc.dashboard.liability.queryOptions({ period }));
  const topProductsQ = useQuery(trpc.dashboard.topProducts.queryOptions({ period, limit: 6 }));
  const salesByStoreQ = useQuery(trpc.dashboard.salesByStore.queryOptions({ period }));
  const now = Date.now();

  // Real KPI cards reuse the existing kpi/kpiSub i18n keys. Sparklines use the
  // purchases series as a lightweight trend visual.
  const spark = (seriesQ.data ?? []).map((p) => p.purchases);
  const ov = overview.data;
  const realKpis: Kpi[] = ov
    ? [
        { key: "activeCustomers", value: fmtNum(ov.totalMembers), ...deltaStr(ov.members.deltaPct), sub: "last30d", spark },
        { key: "purchasesTracked", value: fmtNum(ov.purchases.value), ...deltaStr(ov.purchases.deltaPct), sub: "perVisit", spark },
        { key: "revenueInfluenced", value: fmtCop(ov.revenueCents.value), ...deltaStr(ov.revenueCents.deltaPct), sub: "loyaltyTied", spark },
        { key: "rewardsRedeemed", value: fmtNum(ov.redemptions.value), ...deltaStr(ov.redemptions.deltaPct), sub: "claimRate", spark },
      ]
    : [];

  const recentPurchases = (recentPurchasesQ.data ?? []).map((r) => ({
    key: r.id,
    initials: initialsOf(r.customerName),
    name: r.customerName,
    store: r.storeName,
    amount: fmtCop(r.amountCents),
    time: agoOf(r.createdAt, now),
  }));
  const topCustomers = (topCustomersQ.data ?? []).map((c) => ({
    key: c.id,
    initials: initialsOf(c.name),
    name: c.name,
    visits: c.visits,
    ltv: fmtCop(c.ltvCents),
  }));
  const recentClaims = (recentRedemptionsQ.data ?? []).map((r) => ({
    key: r.id,
    emoji: r.rewardIcon ?? "🎁",
    name: r.rewardName,
    by: r.customerName,
    pts: r.currency === "points" ? `${r.pointsSpent}` : `${r.stampsSpent}`,
    ago: agoOf(r.createdAt, now),
  }));
  const atRisk = (atRiskQ.data ?? []).map((r) => ({
    key: r.id,
    initials: initialsOf(r.name),
    name: r.name,
    ago: `${r.daysSince} d`,
  }));
  // Tier distribution as donut slices (real, replaces the mock engagement mix).
  const tierColors: Record<string, string> = {
    hoja: "var(--primary)",
    flor: "color-mix(in srgb, var(--primary) 45%, #fff)",
    oro: "#f0a868",
  };
  const tierTotal = (tiersQ.data?.tiers ?? []).reduce((s, t) => s + t.count, 0) || 1;
  const tierMix = (tiersQ.data?.tiers ?? []).map((t) => ({
    key: t.key,
    pct: Math.round((t.count / tierTotal) * 100),
    color: tierColors[t.key] ?? "#c7cdd4",
  }));
  const topProducts = topProductsQ.data ?? [];
  const salesByStore = salesByStoreQ.data ?? [];
  const retention = retentionQ.data;
  const engagement = engagementQ.data;
  const liability = liabilityQ.data;

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
              {p}
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
        {overview.isPending
          ? Array.from({ length: 4 }, (_, idx) => (
              <div key={idx} className="bg-card border-border rounded-2xl border p-4">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="mt-3 h-7 w-20" />
                <Skeleton className="mt-2 h-3 w-16" />
              </div>
            ))
          : realKpis.map((k) => <KpiCard key={k.key} kpi={k} style={fade(i++)} />)}
      </div>

      {/* Campaigns + promos — real stats (last 30d) */}
      <div className="mt-3" style={fade(i++)}>
        <CampaignsKpiStrip />
      </div>
      <div className="mt-3" style={fade(i++)}>
        <PromoKpiStrip />
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
            {seriesQ.isPending ? (
              <Skeleton className="size-full rounded-xl" />
            ) : (
              <AreaChart series={(seriesQ.data ?? []).map((s) => s.purchases)} />
            )}
          </div>
        </ChartCard>
        <ChartCard
          title={t("tiersTitle")}
          subtitle={t("tiersSubtitle", { n: tiersQ.data?.activeStreaks ?? 0 })}
          style={fade(i++)}
        >
          <div className="flex flex-wrap items-center justify-center gap-4">
            {tiersQ.isPending ? (
              <Skeleton className="size-40 flex-none rounded-full" />
            ) : (
              <Donut
                slices={tierMix}
                center={fmtNum(tierTotal)}
                centerSub={t("membersShort")}
              />
            )}
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
      </div>

      {/* DAU + redemptions */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard
          title={t("dauTitle")}
          subtitle={t("dauSubtitle")}
          badge={t("dauAvg", { n: dauAvg })}
          beta
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
            {seriesQ.isPending ? (
              <Skeleton className="size-full rounded-xl" />
            ) : (
              <AreaChart series={(seriesQ.data ?? []).map((s) => s.redemptions)} color="#f0a868" />
            )}
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

        <DashboardPromoCard style={fade(i++)} />
      </div>

      {/* Recent purchases + top customers */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title={t("recentPurchasesTitle")} live style={fade(i++)}>
          <ul className="divide-border divide-y">
            {recentPurchasesQ.isPending ? <SkeletonRows rows={6} /> : null}
            {recentPurchases.map((p) => (
              <li key={p.key} className="flex items-center gap-3 py-2.5">
                <AvatarChip initials={p.initials} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{p.name}</div>
                  {p.store ? (
                    <div className="text-muted-foreground/70 truncate text-xs font-semibold">
                      {p.store}
                    </div>
                  ) : null}
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{p.amount}</div>
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
            {topCustomersQ.isPending ? <SkeletonRows rows={6} /> : null}
            {topCustomers.map((c, idx) => (
              <li key={c.key} className="flex items-center gap-3 py-2.5">
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
            {!atRiskQ.isPending && atRisk.length === 0 ? (
              <li className="text-muted-foreground py-4 text-sm font-semibold">
                {t("atRiskEmpty")}
              </li>
            ) : null}
            {atRiskQ.isPending ? <SkeletonRows rows={5} /> : null}
            {atRisk.map((c) => (
              <li key={c.key} className="flex items-center gap-3 py-2.5">
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
            {recentRedemptionsQ.isPending ? <SkeletonRows rows={6} /> : null}
            {recentClaims.map((c) => (
              <li key={c.key} className="flex items-center gap-3 py-2.5">
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

      {/* Retention + program liability */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title={t("retentionTitle")} subtitle={t("retentionSubtitle")} style={fade(i++)}>
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label={t("repeatRate")} value={`${retention?.repeatRatePct ?? 0}%`} />
            <MiniStat label={t("avgVisits")} value={`${retention?.avgVisits ?? 0}`} />
            <MiniStat label={t("redeemerRate")} value={`${engagement?.redeemerRatePct ?? 0}%`} />
          </div>
        </ChartCard>
        <ChartCard title={t("liabilityTitle")} subtitle={t("liabilitySubtitle")} style={fade(i++)}>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label={t("stampsOutstanding")} value={fmtNum(liability?.stampsOutstanding ?? 0)} />
            <MiniStat label={t("pointsOutstanding")} value={fmtNum(liability?.pointsOutstanding ?? 0)} />
          </div>
          <p className="text-muted-foreground mt-3 text-xs font-semibold">
            {t("pointsFlow", {
              earned: fmtNum(liability?.pointsEarned ?? 0),
              redeemed: fmtNum(liability?.pointsRedeemed ?? 0),
            })}
          </p>
        </ChartCard>
      </div>

      {/* Top products (with margin) + sales by store */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title={t("topProductsTitle")} subtitle={t("topProductsSubtitle")} style={fade(i++)}>
          {topProductsQ.isPending ? (
            <ul className="divide-border divide-y"><SkeletonRows rows={6} /></ul>
          ) : topProducts.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm font-semibold">{t("noData")}</p>
          ) : (
            <ul className="divide-border divide-y">
              {topProducts.map((p, idx) => (
                <li key={p.productId} className="flex items-center gap-3 py-2.5">
                  <span className="text-muted-foreground/60 w-4 text-sm font-bold">{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{p.name}</div>
                    <div className="text-muted-foreground/70 text-xs font-semibold">
                      {t("unitsSold", { n: p.units })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{fmtCop(p.revenueCents)}</div>
                    <div className="text-primary text-xs font-extrabold">
                      {p.marginPct != null ? t("marginShort", { pct: p.marginPct }) : "—"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
        <ChartCard title={t("salesByStoreTitle")} style={fade(i++)}>
          {salesByStoreQ.isPending ? (
            <ul className="divide-border divide-y"><SkeletonRows rows={3} /></ul>
          ) : salesByStore.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm font-semibold">{t("noData")}</p>
          ) : (
            <ul className="divide-border divide-y">
              {salesByStore.map((s) => (
                <li key={s.storeId ?? "none"} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{s.name ?? "—"}</div>
                    <div className="text-muted-foreground/70 text-xs font-semibold">
                      {t("salesN", { n: s.count })}
                    </div>
                  </div>
                  <span className="text-sm font-bold">{fmtCop(s.revenueCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-xl font-semibold">{value}</div>
      <div className="text-muted-foreground/70 text-xs font-semibold">{label}</div>
    </div>
  );
}

/** Placeholder rows for a list widget while its query is loading. Renders <li>
 *  so it drops straight into the widgets' <ul>. */
function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <li key={`sk-${i}`} className="flex items-center gap-3 py-2.5">
          <Skeleton className="size-9 flex-none rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-3.5 w-12" />
        </li>
      ))}
    </>
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
