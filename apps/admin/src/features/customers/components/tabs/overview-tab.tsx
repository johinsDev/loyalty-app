"use client";

import type { CustomerStats } from "@loyalty/api/features/customers/schemas";
import {
  Badge,
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@loyalty/ui";
import { CalendarClock, Coins, Package, Receipt, Store, TrendingUp } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { money } from "@/lib/money";

/** Recharts needs a concrete fill — the admin re-skin doesn't expose `--color-*`
 *  to the chart at paint time. Same accent the other admin charts use. */
const ACCENT = "#7c5cff";

export function OverviewTab({ stats }: { stats: CustomerStats }) {
  const t = useTranslations("Customers");
  const format = useFormatter();

  const config = {
    spend: { label: t("stat.monthlySpend"), color: ACCENT },
  } satisfies ChartConfig;

  const chartData = stats.monthly.map((m) => ({
    // "2026-07" → localized short month. Noon UTC keeps the label off a DST edge.
    month: format.dateTime(new Date(`${m.month}-01T12:00:00Z`), { month: "short" }),
    spend: m.spendCents / 100,
    visits: m.visits,
  }));
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
        <Tile icon={Coins} label={t("stat.ltv")} value={money(format, stats.ltvCents)} />
        <Tile icon={Receipt} label={t("stat.avgTicket")} value={money(format, stats.avgTicketCents)} />
        <Tile icon={TrendingUp} label={t("stat.visits")} value={String(stats.visits)} />
        <Tile
          icon={CalendarClock}
          label={t("stat.cadence")}
          value={
            stats.avgDaysBetween == null
              ? "—"
              : t("stat.cadenceValue", { n: stats.avgDaysBetween })
          }
        />
      </div>

      {topPercent != null ? (
        <Badge variant="secondary" className="gap-1.5">
          <TrendingUp className="size-3.5" />
          {t("stat.topPercentile", { n: topPercent })}
        </Badge>
      ) : null}

      <section className="bg-card border-border rounded-2xl border p-5 shadow-sm">
        <h2 className="text-muted-foreground/70 mb-4 text-xs font-extrabold tracking-wider uppercase">
          {t("stat.monthlySpend")}
        </h2>
        {hasSpend ? (
          <ChartContainer config={config} className="aspect-auto w-full" style={{ height: 224 }}>
            <BarChart data={chartData} margin={{ top: 6, right: 6, bottom: 0, left: 0 }} barCategoryGap="30%">
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="spend" fill={ACCENT} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        ) : (
          <p className="text-muted-foreground grid h-32 place-items-center text-sm">
            {t("stat.noData")}
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        <Highlight
          icon={Package}
          label={t("stat.topProduct")}
          title={stats.topProduct?.name ?? null}
          caption={
            stats.topProduct ? t("stat.productQty", { n: stats.topProduct.qty }) : t("stat.noData")
          }
        />
      </div>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Coins;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-card border-border min-w-0 rounded-2xl border p-4 shadow-sm">
      <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs font-extrabold tracking-wider uppercase">
        <Icon className="size-3.5 flex-none" />
        <span className="truncate">{label}</span>
      </div>
      <div className="font-display mt-1 truncate text-2xl font-semibold tracking-tight">{value}</div>
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
