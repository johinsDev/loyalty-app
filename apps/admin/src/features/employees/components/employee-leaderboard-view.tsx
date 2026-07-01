"use client";

import type {
  LeaderboardPeriod,
  LeaderboardRow,
} from "@loyalty/api/features/employees/schemas";
import {
  Badge,
  Calendar,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@loyalty/ui";
import { localeFromCode } from "@loyalty/date";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpDown, Medal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { DataTableFilters, FilterSection } from "@/components/data-table";
import { Donut } from "@/features/dashboard/components/charts";
import { Link } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

import { initialsFor } from "../lib";

const PERIODS: LeaderboardPeriod[] = ["month", "lastMonth", "range"];

type MetricKey =
  | "sales"
  | "revenueCents"
  | "avgTicketCents"
  | "maxTicketCents"
  | "uniqueCustomers"
  | "stamps"
  | "redemptions"
  | "points";

const METRICS: { key: MetricKey; money?: boolean }[] = [
  { key: "sales" },
  { key: "revenueCents", money: true },
  { key: "avgTicketCents", money: true },
  { key: "maxTicketCents", money: true },
  { key: "uniqueCustomers" },
  { key: "stamps" },
  { key: "redemptions" },
  { key: "points" },
];

const RANK_COLOR = ["#f5b301", "#9aa1ab", "#cd7f32"];
const PALETTE = ["#7c5cff", "#1f9d68", "#c98a00", "#e5484d", "#0ea5e9"];

/** Team performance leaderboard — KPI cards, a bar ranking + revenue-share
 *  donut, and a ranked table with inline bars. Sortable by any metric; data is
 *  small (whole team), so sorting/derived visuals are client-side. */
export function EmployeeLeaderboardView() {
  const t = useTranslations("Employees");
  const locale = useLocale();
  const trpc = useTRPC();

  const [period, setPeriod] = useState<LeaderboardPeriod>("month");
  const [stores, setStores] = useState<string[]>([]);
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({});
  const [sortKey, setSortKey] = useState<MetricKey>("revenueCents");

  const money = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }),
    [locale],
  );
  const fmtVal = (row: LeaderboardRow, m: MetricKey, isMoney?: boolean) =>
    isMoney ? money.format((row[m] as number) / 100) : (row[m] as number).toLocaleString();

  const { data: storesData } = useQuery(
    trpc.stores.list.queryOptions({ page: 1, perPage: 100, sort: [] }),
  );
  const storeOptions = storesData?.rows ?? [];

  const input = useMemo(
    () => ({
      period,
      storeId: stores.length > 0 ? stores : undefined,
      from: period === "range" ? range.from : undefined,
      to: period === "range" ? range.to : undefined,
    }),
    [period, stores, range],
  );

  const { data } = useQuery(
    trpc.employees.leaderboard.queryOptions(input, { placeholderData: keepPreviousData }),
  );
  const all = useMemo(() => data?.rows ?? [], [data]);

  const rows = useMemo(
    () => [...all].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number)),
    [all, sortKey],
  );

  // ── Derived: KPIs, donut, bar scaling ───────────────────────────────────────
  const totals = useMemo(() => {
    const revenue = all.reduce((s, r) => s + r.revenueCents, 0);
    const sales = all.reduce((s, r) => s + r.sales, 0);
    const byRevenue = [...all].sort((a, b) => b.revenueCents - a.revenueCents);
    return {
      revenue,
      sales,
      avgTicket: sales > 0 ? Math.round(revenue / sales) : 0,
      top: byRevenue[0],
      byRevenue,
    };
  }, [all]);

  const donutSlices = useMemo(() => {
    const { revenue, byRevenue } = totals;
    if (revenue <= 0) return [];
    const slices = byRevenue
      .slice(0, 5)
      .filter((r) => r.revenueCents > 0)
      .map((r, i) => ({
        key: r.name ?? r.email ?? "—",
        pct: Math.round((r.revenueCents / revenue) * 100),
        color: PALETTE[i] ?? "#9aa1ab",
      }));
    const othersRevenue = byRevenue.slice(5).reduce((s, r) => s + r.revenueCents, 0);
    if (othersRevenue > 0) {
      slices.push({
        key: t("leaderboard.others"),
        pct: Math.round((othersRevenue / revenue) * 100),
        color: "#9aa1ab",
      });
    }
    return slices;
  }, [totals, t]);

  const sortedMeta = METRICS.find((m) => m.key === sortKey);
  const maxSorted = Math.max(1, ...rows.map((r) => r[sortKey] as number));

  const activeFacets = (stores.length > 0 ? 1 : 0) + (range.from || range.to ? 1 : 0);

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <Link
        href="/employees"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-bold"
      >
        <ArrowLeft className="size-4" />
        {t("title")}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t("leaderboard.title")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {data ? `${data.from} – ${data.to}` : t("leaderboard.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-card border-border inline-flex rounded-full border p-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`h-8 rounded-full px-3.5 text-sm font-bold transition-colors ${
                  period === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`leaderboard.period.${p}`)}
              </button>
            ))}
          </div>
          <DataTableFilters
            activeCount={activeFacets}
            onClear={() => {
              setStores([]);
              setRange({});
            }}
          >
            {storeOptions.length > 0 ? (
              <FilterSection label={t("col.stores")}>
                {storeOptions.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
                    <Checkbox
                      checked={stores.includes(s.id)}
                      onCheckedChange={() =>
                        setStores(
                          stores.includes(s.id) ? stores.filter((x) => x !== s.id) : [...stores, s.id],
                        )
                      }
                    />
                    {s.name}
                  </label>
                ))}
              </FilterSection>
            ) : null}
            {period === "range" ? (
              <FilterSection label={t("detail.dateRange")}>
                <div className="border-border flex justify-center rounded-2xl border p-1.5">
                  <Calendar
                    mode="range"
                    className="[--cell-size:--spacing(9)]"
                    locale={localeFromCode(locale)}
                    selected={{ from: range.from ?? undefined, to: range.to ?? undefined }}
                    onSelect={(r: { from?: Date; to?: Date } | undefined) => setRange(r ?? {})}
                    disabled={{ after: new Date() }}
                  />
                </div>
              </FilterSection>
            ) : null}
          </DataTableFilters>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t("leaderboard.metric.revenueCents")} value={money.format(totals.revenue / 100)} />
        <Kpi label={t("leaderboard.metric.sales")} value={totals.sales.toLocaleString()} />
        <Kpi label={t("leaderboard.teamAvgTicket")} value={money.format(totals.avgTicket / 100)} />
        <Kpi
          label={t("leaderboard.topSeller")}
          value={totals.top?.name ?? totals.top?.email ?? "—"}
        />
      </div>

      {/* Bar ranking + donut */}
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="bg-card border-border lg:col-span-2 rounded-3xl border p-5 shadow-sm">
          <p className="text-muted-foreground/70 mb-3 text-xs font-bold tracking-wider uppercase">
            {t("leaderboard.rankingBy", { metric: t(`leaderboard.metric.${sortKey}`) })}
          </p>
          {rows.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">{t("empty")}</p>
          ) : (
            <ul className="space-y-2.5">
              {rows.slice(0, 8).map((row, i) => {
                const val = row[sortKey] as number;
                return (
                  <li key={row.userId} className="flex items-center gap-3">
                    <span className="text-muted-foreground w-24 flex-none truncate text-sm font-semibold">
                      {row.name ?? row.email ?? "—"}
                    </span>
                    <div className="bg-muted h-6 flex-1 overflow-hidden rounded-lg">
                      <div
                        className="flex h-full items-center rounded-lg"
                        style={{
                          width: `${Math.max(2, (val / maxSorted) * 100)}%`,
                          backgroundColor: i < 3 ? RANK_COLOR[i] : "var(--primary)",
                        }}
                      />
                    </div>
                    <span className="w-24 flex-none text-right text-sm font-bold tabular-nums">
                      {fmtVal(row, sortKey, sortedMeta?.money)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="bg-card border-border rounded-3xl border p-5 shadow-sm">
          <p className="text-muted-foreground/70 mb-3 text-xs font-bold tracking-wider uppercase">
            {t("leaderboard.share")}
          </p>
          {donutSlices.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">{t("empty")}</p>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Donut slices={donutSlices} center={`${donutSlices[0]?.pct ?? 0}%`} centerSub={t("leaderboard.metric.revenueCents")} />
              <ul className="w-full space-y-1.5 text-sm">
                {donutSlices.map((s) => (
                  <li key={s.key} className="flex items-center gap-2">
                    <span className="size-2.5 flex-none rounded-full" style={{ background: s.color }} />
                    <span className="flex-1 truncate">{s.key}</span>
                    <span className="font-bold">{s.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Ranked table with inline bars */}
      <div className="bg-card border-border mt-3 overflow-x-auto rounded-3xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>{t("col.employee")}</TableHead>
              {METRICS.map((m) => (
                <TableHead key={m.key} className="text-right">
                  <button
                    type="button"
                    onClick={() => setSortKey(m.key)}
                    className={`inline-flex items-center gap-1 hover:text-foreground ${
                      sortKey === m.key ? "text-foreground font-bold" : ""
                    }`}
                  >
                    {t(`leaderboard.metric.${m.key}`)}
                    <ArrowUpDown className="size-3" />
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={row.userId} className="text-sm">
                <TableCell className="text-center">
                  {i < 3 ? (
                    <Medal className="mx-auto size-4" style={{ color: RANK_COLOR[i] }} />
                  ) : (
                    <span className="text-muted-foreground">{i + 1}</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <span className="bg-primary/10 text-primary grid size-8 flex-none place-items-center rounded-full text-xs font-bold">
                      {initialsFor(row)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{row.name ?? row.email ?? "—"}</p>
                      <Badge variant="secondary" className="mt-0.5 text-[0.625rem]">
                        {t(`role.${row.role}`)}
                      </Badge>
                    </div>
                  </div>
                </TableCell>
                {METRICS.map((m) => {
                  const active = sortKey === m.key;
                  const val = row[m.key] as number;
                  return (
                    <TableCell key={m.key} className="text-right tabular-nums">
                      {active ? (
                        <div className="relative flex h-6 items-center justify-end">
                          <div
                            className="bg-primary/10 absolute inset-y-0 right-0 rounded"
                            style={{ width: `${Math.max(3, (val / maxSorted) * 100)}%` }}
                          />
                          <span className="relative pr-1 font-bold">
                            {fmtVal(row, m.key, m.money)}
                          </span>
                        </div>
                      ) : (
                        fmtVal(row, m.key, m.money)
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border-border rounded-2xl border p-4 shadow-sm">
      <div className="text-muted-foreground/70 text-xs font-bold tracking-wider uppercase">
        {label}
      </div>
      <div className="font-display mt-1 truncate text-xl font-semibold tracking-tight">
        {value}
      </div>
    </div>
  );
}
