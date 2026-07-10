"use client";

import type { CustomerStats } from "@loyalty/api/features/customers/schemas";
import {
  Badge,
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Skeleton,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Coins, Package, Receipt, Store, TrendingUp } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import { compactMoney, compactNumber, money } from "@/lib/money";
import { useTRPC } from "@/lib/trpc/client";

/** Recharts needs concrete fills — the admin re-skin doesn't expose `--color-*`
 *  to the chart at paint time. Same accents the other admin charts use. */
const ACCENT = "#7c5cff";
const ACCENT_ALT = "#e0467c";

export function OverviewTab({
  stats,
  customerId,
}: {
  stats: CustomerStats;
  customerId: string;
}) {
  const t = useTranslations("Customers");
  const format = useFormatter();

  const hasSpend = stats.monthly.some((m) => m.spendCents > 0);

  // `spendPercentile` is the share of customers who spend LESS, so "top X%" is
  // its complement. Only brag from the top half up, and never render "top 0%"
  // (the single highest spender) or "top 100%" (the org's only customer).
  const topPercent =
    stats.spendPercentile != null && stats.spendPercentile >= 50
      ? Math.min(50, Math.max(1, 100 - stats.spendPercentile))
      : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          icon={Coins}
          label={t("stat.ltv")}
          value={compactMoney(format, stats.ltvCents)}
          exact={money(format, stats.ltvCents)}
        />
        <Tile
          icon={Receipt}
          label={t("stat.avgTicket")}
          value={compactMoney(format, stats.avgTicketCents)}
          exact={money(format, stats.avgTicketCents)}
        />
        <Tile
          icon={TrendingUp}
          label={t("stat.visits")}
          value={compactNumber(format, stats.visits)}
          exact={format.number(stats.visits)}
        />
        <Tile icon={CalendarClock} label={t("stat.cadence")} value={cadence(t, stats)} />
      </div>

      {topPercent != null ? (
        <Badge variant="secondary" className="gap-1.5">
          <TrendingUp className="size-3.5" />
          {t("stat.topPercentile", { n: topPercent })}
        </Badge>
      ) : null}

      <TierProgress customerId={customerId} />

      <section className="bg-card border-border rounded-2xl border p-5 shadow-sm">
        <h2 className="text-muted-foreground/70 mb-4 text-xs font-extrabold tracking-wider uppercase">
          {t("stat.monthlyTitle")}
        </h2>
        {hasSpend ? (
          <SpendChart stats={stats} />
        ) : (
          <p className="text-muted-foreground grid h-32 place-items-center text-sm">
            {t("stat.noData")}
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <TopProducts stats={stats} />
        <div className="space-y-3">
          <RedemptionMix stats={stats} />
          <Highlight
            icon={Store}
            label={t("stat.favoriteStore")}
            title={stats.favoriteStore?.name ?? null}
            caption={
              stats.favoriteStore
                ? t("stat.storeVisits", { n: stats.favoriteStore.visits })
                : t("stat.noData")
            }
          />
        </div>
      </div>
    </div>
  );
}

/** 25 visits over two days averages to zero days between them — say so rather
 *  than printing "every 0 d". */
function cadence(t: ReturnType<typeof useTranslations>, stats: CustomerStats): string {
  if (stats.avgDaysBetween == null) return "—";
  if (stats.avgDaysBetween === 0) return t("stat.cadenceSameDay");
  return t("stat.cadenceValue", { n: stats.avgDaysBetween });
}

function SpendChart({ stats }: { stats: CustomerStats }) {
  const t = useTranslations("Customers");
  const format = useFormatter();

  const config = {
    spend: { label: t("stat.monthlySpend"), color: ACCENT },
    visits: { label: t("stat.monthlyVisits"), color: ACCENT_ALT },
  } satisfies ChartConfig;

  const data = stats.monthly.map((m) => ({
    // "2026-07" → localized short month. Noon UTC keeps the label off a DST edge.
    month: format.dateTime(new Date(`${m.month}-01T12:00:00Z`), { month: "short" }),
    spend: m.spendCents / 100,
    visits: m.visits,
  }));

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: 224 }}>
      <ComposedChart
        data={data}
        margin={{ top: 6, right: 6, bottom: 0, left: 0 }}
        barCategoryGap="30%"
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        {/* Spend dwarfs the visit count, so each series gets its own hidden scale. */}
        <YAxis yAxisId="spend" hide />
        <YAxis yAxisId="visits" orientation="right" hide />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar yAxisId="spend" dataKey="spend" fill={ACCENT} radius={[3, 3, 0, 0]} />
        <Line
          yAxisId="visits"
          type="monotone"
          dataKey="visits"
          stroke={ACCENT_ALT}
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ChartContainer>
  );
}

/** Points earned in the rolling 30-day window drive the tier, so this is the
 *  one number that says whether they're about to move up or fall. */
function TierProgress({ customerId }: { customerId: string }) {
  const t = useTranslations("Customers");
  const format = useFormatter();
  const trpc = useTRPC();
  const { data } = useQuery(trpc.points.summaryForCustomer.queryOptions({ customerId }));

  if (!data) {
    return <Skeleton className="h-24 w-full rounded-2xl" />;
  }

  const pct = Math.round(data.progress * 100);

  return (
    <section className="bg-card border-border rounded-2xl border p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-muted-foreground/70 text-xs font-extrabold tracking-wider uppercase">
          {t("stat.tierProgress")}
        </h2>
        {data.nearNext ? (
          <Badge variant="secondary">{t("stat.tierNear")}</Badge>
        ) : null}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-2xl font-semibold tracking-tight">
          {t(`tier.${data.current.key}`)}
        </span>
        {data.next ? (
          <span className="text-muted-foreground text-sm font-semibold">
            → {t(`tier.${data.next.key}`)}
          </span>
        ) : null}
      </div>

      <div className="bg-muted mt-3 h-2 overflow-hidden rounded-full">
        <span
          className="from-primary to-primary/60 block h-full rounded-full bg-gradient-to-r"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-muted-foreground mt-2 text-xs font-semibold">
        {data.next
          ? t("stat.tierRemaining", {
              n: format.number(data.remainingToNext),
              days: data.windowDays,
            })
          : t("stat.tierMax", { n: format.number(data.tierPoints), days: data.windowDays })}
      </p>
    </section>
  );
}

function RedemptionMix({ stats }: { stats: CustomerStats }) {
  const t = useTranslations("Customers");
  const { stamps, points } = stats.redemptionMix;
  const total = stamps + points;

  const config = {
    stamps: { label: t("stat.mixStamps"), color: ACCENT },
    points: { label: t("stat.mixPoints"), color: ACCENT_ALT },
  } satisfies ChartConfig;

  return (
    <section className="bg-card border-border rounded-2xl border p-5 shadow-sm">
      <h2 className="text-muted-foreground/70 text-xs font-extrabold tracking-wider uppercase">
        {t("stat.redemptionMix")}
      </h2>
      {total === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">{t("stat.noRedemptions")}</p>
      ) : (
        <div className="flex items-center gap-4">
          <ChartContainer config={config} className="aspect-square" style={{ height: 120 }}>
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie
                data={[
                  { name: t("stat.mixStamps"), value: stamps, key: "stamps" },
                  { name: t("stat.mixPoints"), value: points, key: "points" },
                ]}
                dataKey="value"
                nameKey="name"
                innerRadius={30}
                outerRadius={55}
                strokeWidth={2}
              >
                <Cell fill={ACCENT} />
                <Cell fill={ACCENT_ALT} />
              </Pie>
            </PieChart>
          </ChartContainer>
          <dl className="min-w-0 flex-1 space-y-2 text-sm">
            <MixRow color={ACCENT} label={t("stat.mixStamps")} n={stamps} total={total} />
            <MixRow color={ACCENT_ALT} label={t("stat.mixPoints")} n={points} total={total} />
          </dl>
        </div>
      )}
    </section>
  );
}

function MixRow({
  color,
  label,
  n,
  total,
}: {
  color: string;
  label: string;
  n: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-2.5 flex-none rounded-sm" style={{ backgroundColor: color }} />
      <dt className="text-muted-foreground min-w-0 flex-1 truncate font-semibold">{label}</dt>
      <dd className="font-bold whitespace-nowrap">
        {n} <span className="text-muted-foreground">({Math.round((n / total) * 100)}%)</span>
      </dd>
    </div>
  );
}

function TopProducts({ stats }: { stats: CustomerStats }) {
  const t = useTranslations("Customers");
  const max = stats.topProducts[0]?.qty ?? 0;

  return (
    <section className="bg-card border-border rounded-2xl border p-5 shadow-sm">
      <h2 className="text-muted-foreground/70 mb-3 flex items-center gap-1.5 text-xs font-extrabold tracking-wider uppercase">
        <Package className="size-3.5" />
        {t("stat.topProducts")}
      </h2>
      {stats.topProducts.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">{t("stat.noData")}</p>
      ) : (
        <ul className="space-y-3">
          {stats.topProducts.map((p) => (
            <li key={p.productId}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-bold">{p.name ?? "—"}</span>
                <span className="text-muted-foreground text-xs font-bold whitespace-nowrap">
                  {t("stat.productQty", { n: p.qty })}
                </span>
              </div>
              <div className="bg-muted mt-1.5 h-1.5 overflow-hidden rounded-full">
                <span
                  className="bg-primary block h-full rounded-full"
                  style={{ width: `${max > 0 ? (p.qty / max) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  exact,
}: {
  icon: typeof Coins;
  label: string;
  /** Abbreviated, so it survives a narrow tile. */
  value: string;
  /** Full-precision value, revealed on hover. */
  exact?: string;
}) {
  return (
    <div className="bg-card border-border min-w-0 rounded-2xl border p-4 shadow-sm">
      <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs font-extrabold tracking-wider uppercase">
        <Icon className="size-3.5 flex-none" />
        <span className="truncate">{label}</span>
      </div>
      <div
        title={exact}
        className="font-display mt-1 truncate text-2xl font-semibold tracking-tight"
      >
        {value}
      </div>
    </div>
  );
}

function Highlight({
  icon: Icon,
  label,
  title,
  caption,
}: {
  icon: typeof Coins;
  label: string;
  title: string | null;
  caption: string;
}) {
  const t = useTranslations("Customers");
  return (
    <div className="bg-card border-border flex items-center gap-3 rounded-2xl border p-4 shadow-sm">
      <span className="bg-primary/10 text-primary grid size-10 flex-none place-items-center rounded-xl">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="text-muted-foreground/70 text-xs font-bold tracking-wider uppercase">
          {label}
        </div>
        <div className="truncate text-sm font-bold">{title ?? t("stat.noData")}</div>
        <div className="text-muted-foreground truncate text-xs">{caption}</div>
      </div>
    </div>
  );
}
