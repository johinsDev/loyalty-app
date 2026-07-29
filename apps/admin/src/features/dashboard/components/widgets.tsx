import { getTranslations } from "next-intl/server";

import { trpc } from "@/lib/trpc/server";

import type { DashboardPeriod } from "../list-params";
import { agoOf, deltaStr, fmtCop, fmtCopCompact, fmtNum, initialsOf } from "../lib/format";
import { getOverview, getSeries } from "../lib/queries";
import { AreaChart, Donut } from "./charts";
import { AvatarChip, ChartCard, KpiCard, MiniStat } from "./dashboard-primitives";

type WidgetProps = { period: DashboardPeriod; storeId: string | null };

/** ROI hero revenue number + delta (the hero shell is static, in the page). */
export async function HeroRevenue({ period, storeId }: WidgetProps) {
  const t = await getTranslations("Dashboard");
  const ov = await getOverview(period, storeId);
  return (
    <div>
      <div className="font-display text-5xl font-semibold tracking-tight">
        {fmtCop(ov.revenueCents.value)}
      </div>
      <div className="mt-1 text-sm font-semibold text-white/85">
        {t("impactRevenue", { delta: deltaStr(ov.revenueCents.deltaPct).delta })}
      </div>
    </div>
  );
}

/** The 4 KPI cards (sparkline = purchases series). */
export async function KpiRow({ period, storeId }: WidgetProps) {
  const t = await getTranslations("Dashboard");
  const [ov, series] = await Promise.all([
    getOverview(period, storeId),
    getSeries(period, storeId),
  ]);
  const spark = series.map((p) => p.purchases);
  const cards = [
    { key: "activeCustomers", value: fmtNum(ov.totalMembers), sub: "last30d", ...deltaStr(ov.members.deltaPct) },
    { key: "purchasesTracked", value: fmtNum(ov.purchases.value), sub: "perVisit", ...deltaStr(ov.purchases.deltaPct) },
    { key: "revenueInfluenced", value: fmtCop(ov.revenueCents.value), sub: "loyaltyTied", ...deltaStr(ov.revenueCents.deltaPct) },
    { key: "rewardsRedeemed", value: fmtNum(ov.redemptions.value), sub: "claimRate", ...deltaStr(ov.redemptions.deltaPct) },
  ];
  return (
    <>
      {cards.map((k) => (
        <KpiCard
          key={k.key}
          label={t(`kpi.${k.key}`)}
          sub={t(`kpiSub.${k.sub}`)}
          value={k.value}
          delta={k.delta}
          trend={k.trend}
          spark={spark}
        />
      ))}
    </>
  );
}

/** Purchases trend area chart (content only — page provides the card + height). */
export async function PurchasesTrend({ period, storeId }: WidgetProps) {
  const series = await getSeries(period, storeId);
  return <AreaChart series={series.map((s) => s.purchases)} />;
}

/** Redemptions trend area chart. */
export async function RedemptionsTrend({ period, storeId }: WidgetProps) {
  const series = await getSeries(period, storeId);
  return <AreaChart series={series.map((s) => s.redemptions)} color="#f0a868" />;
}

const TIER_COLORS: Record<string, string> = {
  hoja: "var(--primary)",
  flor: "color-mix(in srgb, var(--primary) 45%, #fff)",
  oro: "#f0a868",
};

/** Categorical ramp for the category mix — brand primary first, then decreasing
 *  tints plus two accents, so 6 slices stay distinguishable in light and dark. */
const CATEGORY_COLORS = [
  "var(--primary)",
  "color-mix(in srgb, var(--primary) 70%, #fff)",
  "color-mix(in srgb, var(--primary) 45%, #fff)",
  "#f0a868",
  "#7fb3a2",
  "color-mix(in srgb, var(--primary) 25%, #fff)",
  "#c7cdd4",
];

/** Tier distribution donut — a full card (its subtitle needs the streak count). */
export async function TierCard() {
  const t = await getTranslations("Dashboard");
  const data = await (await trpc()).dashboard.tiers();
  const total = data.tiers.reduce((s, x) => s + x.count, 0) || 1;
  const mix = data.tiers.map((x) => ({
    key: x.key,
    pct: Math.round((x.count / total) * 100),
    color: TIER_COLORS[x.key] ?? "#c7cdd4",
  }));
  return (
    <ChartCard title={t("tiersTitle")} subtitle={t("tiersSubtitle", { n: data.activeStreaks })}>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Donut slices={mix} center={fmtNum(total)} centerSub={t("membersShort")} />
        <ul className="min-w-40 flex-1 space-y-2 text-sm">
          {mix.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span className="size-2.5 flex-none rounded-full" style={{ background: s.color }} />
              <span className="flex-1">{t(`tier.${s.key}`)}</span>
              <span className="font-bold">{s.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}

/** Weekly retention cohorts table. */
export async function CohortsTable() {
  const t = await getTranslations("Dashboard");
  const data = await (await trpc()).dashboard.cohorts();
  const rows = data.cohorts.map((c) => ({
    label: new Date(c.label).toLocaleDateString("es-CO", { day: "numeric", month: "short" }),
    weeks: c.retention,
  }));
  if (rows.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm font-semibold">{t("noData")}</p>;
  }
  return (
    <table className="w-full text-center text-xs">
      <thead>
        <tr className="text-muted-foreground/70 font-bold">
          <th className="py-1 text-left font-bold">{t("cohort")}</th>
          {Array.from({ length: data.weeks }, (_, k) => (
            <th key={`S${k}`} className="py-1 font-bold">
              S{k}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td className="text-muted-foreground py-1 text-left font-bold">{row.label}</td>
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
  );
}

/** Live recent-purchases list. */
export async function RecentPurchases({ storeId }: Pick<WidgetProps, "storeId">) {
  const rows = await (await trpc()).dashboard.recentPurchases({ limit: 6, storeId });
  const now = Date.now();
  return (
    <ul className="divide-border divide-y">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-3 py-2.5">
          <AvatarChip initials={initialsOf(r.customerName)} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{r.customerName}</div>
            {r.storeName ? (
              <div className="text-muted-foreground/70 truncate text-xs font-semibold">
                {r.storeName}
              </div>
            ) : null}
          </div>
          <div className="text-right text-sm font-bold">{fmtCop(r.amountCents)}</div>
          <span className="text-muted-foreground/70 w-12 text-right text-xs font-semibold">
            {agoOf(r.createdAt, now)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Top customers by LTV. */
export async function TopCustomers({ period, storeId }: WidgetProps) {
  const t = await getTranslations("Dashboard");
  const rows = await (await trpc()).dashboard.topCustomers({ period, limit: 6, storeId });
  return (
    <ul className="divide-border divide-y">
      {rows.map((c, idx) => (
        <li key={c.id} className="flex items-center gap-3 py-2.5">
          <span className="text-muted-foreground/60 w-4 text-sm font-bold">{idx + 1}</span>
          <AvatarChip initials={initialsOf(c.name)} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{c.name}</div>
            <div className="text-muted-foreground/70 text-xs font-semibold">
              {t("visits", { count: c.visits })}
            </div>
          </div>
          <span className="text-primary text-sm font-extrabold">{fmtCop(c.ltvCents)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Recent reward claims. */
export async function RecentClaims() {
  const rows = await (await trpc()).dashboard.recentRedemptions({ limit: 6 });
  const now = Date.now();
  return (
    <ul className="divide-border divide-y">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-3 py-2.5">
          <span className="bg-primary/10 grid size-9 flex-none place-items-center rounded-xl text-lg">
            {r.rewardIcon ?? "🎁"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{r.rewardName}</div>
            <div className="text-muted-foreground/70 text-xs font-semibold">{r.customerName}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold">
              {r.currency === "points" ? r.pointsSpent : r.stampsSpent} pts
            </div>
            <div className="text-muted-foreground/70 text-xs font-semibold">
              {agoOf(r.createdAt, now)}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** At-risk (churn candidate) customers. */
export async function AtRisk({ storeId }: Pick<WidgetProps, "storeId">) {
  const t = await getTranslations("Dashboard");
  const rows = await (await trpc()).dashboard.atRisk({ days: 30, limit: 5, storeId });
  if (rows.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm font-semibold">{t("atRiskEmpty")}</p>;
  }
  return (
    <ul className="divide-border divide-y">
      {rows.map((c) => (
        <li key={c.id} className="flex items-center gap-3 py-2.5">
          <AvatarChip initials={initialsOf(c.name)} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{c.name}</div>
            <div className="text-muted-foreground/70 text-xs font-semibold">
              {t("lastVisitAgo", { ago: `${c.daysSince} d` })}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Retention mini-stats (repeat rate, avg visits, redeemer rate). */
export async function RetentionStats({ period }: Pick<WidgetProps, "period">) {
  const t = await getTranslations("Dashboard");
  const api = await trpc();
  const [retention, engagement] = await Promise.all([
    api.dashboard.retention({ period }),
    api.dashboard.redemptionEngagement({ period }),
  ]);
  return (
    <div className="grid grid-cols-3 gap-3">
      <MiniStat label={t("repeatRate")} value={`${retention.repeatRatePct}%`} />
      <MiniStat label={t("avgVisits")} value={`${retention.avgVisits}`} />
      <MiniStat label={t("redeemerRate")} value={`${engagement.redeemerRatePct}%`} />
    </div>
  );
}

/** Outstanding program liability (stamps/points) + points flow. */
export async function LiabilityStats({ period }: Pick<WidgetProps, "period">) {
  const t = await getTranslations("Dashboard");
  const l = await (await trpc()).dashboard.liability({ period });
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <MiniStat label={t("stampsOutstanding")} value={fmtNum(l.stampsOutstanding)} />
        <MiniStat label={t("pointsOutstanding")} value={fmtNum(l.pointsOutstanding)} />
      </div>
      <p className="text-muted-foreground mt-3 text-xs font-semibold">
        {t("pointsFlow", { earned: fmtNum(l.pointsEarned), redeemed: fmtNum(l.pointsRedeemed) })}
      </p>
    </>
  );
}

/** Best-selling products with gross margin. */
export async function TopProducts({ period, storeId }: WidgetProps) {
  const t = await getTranslations("Dashboard");
  const rows = await (await trpc()).dashboard.topProducts({ period, limit: 6, storeId });
  if (rows.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm font-semibold">{t("noData")}</p>;
  }
  return (
    <ul className="divide-border divide-y">
      {rows.map((p, idx) => (
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
  );
}

/**
 * Where the money comes from, by category. Sub-category sales fold into their
 * root and each product is attributed to exactly one category, so the slices add
 * up to the window's revenue instead of double-counting a product filed in two.
 */
export async function CategoryMix({ period, storeId }: WidgetProps) {
  const t = await getTranslations("Dashboard");
  const rows = await (await trpc()).dashboard.categoryMix({ period, limit: 6, storeId });
  const total = rows.reduce((sum, r) => sum + r.revenueCents, 0);
  if (rows.length === 0 || total === 0) {
    return <p className="text-muted-foreground py-4 text-sm font-semibold">{t("noData")}</p>;
  }

  const labelOf = (row: (typeof rows)[number]) =>
    row.name ?? (row.categoryId === "__rest__" ? t("categoryRest") : t("categoryNone"));

  const slices = rows.map((r, i) => ({
    key: labelOf(r),
    pct: r.sharePct,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length]!,
  }));

  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      {/* Compact in the hole: a full COP amount spills over the ring. The exact
          figures are right there in the list beside it. */}
      <Donut slices={slices} center={fmtCopCompact(total)} centerSub={t("revenueShort")} />
      <ul className="min-w-48 flex-1 space-y-2 text-sm">
        {rows.map((r, i) => (
          <li key={r.categoryId ?? "none"} className="flex items-center gap-2">
            <span
              className="size-2.5 flex-none rounded-full"
              style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
            />
            <span className="min-w-0 flex-1 truncate">{labelOf(r)}</span>
            <span className="tabular-nums">{fmtCop(r.revenueCents)}</span>
            <span className="w-10 text-right font-bold tabular-nums">{r.sharePct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Sales split by store. */
export async function SalesByStore({ period }: Pick<WidgetProps, "period">) {
  const t = await getTranslations("Dashboard");
  const rows = await (await trpc()).dashboard.salesByStore({ period });
  if (rows.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm font-semibold">{t("noData")}</p>;
  }
  return (
    <ul className="divide-border divide-y">
      {rows.map((s) => (
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
  );
}
