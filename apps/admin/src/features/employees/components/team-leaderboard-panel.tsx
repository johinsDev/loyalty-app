"use client";

import { Badge } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Medal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import { Link } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

import { initialsFor } from "../lib";

const RANK_COLOR = ["#f5b301", "#9aa1ab", "#cd7f32"];

/** Compact "top sellers this month" leaderboard for the Analytics section. Links
 *  through to the full team performance view. */
export function TeamLeaderboardPanel() {
  const t = useTranslations("Employees");
  const locale = useLocale();
  const trpc = useTRPC();

  const money = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }),
    [locale],
  );

  const { data } = useQuery(
    trpc.employees.leaderboard.queryOptions({ period: "month", limit: 5 }),
  );
  const rows = data?.rows ?? [];

  return (
    <div className="bg-card min-w-0 rounded-3xl border p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {t("leaderboard.title")}
          </h2>
          <p className="text-muted-foreground/80 mt-0.5 text-xs font-semibold">
            {t("leaderboard.thisMonth")}
          </p>
        </div>
        <Link
          href="/employees/performance"
          className="text-primary inline-flex items-center gap-1 text-sm font-bold hover:underline"
        >
          {t("leaderboard.seeAll")}
          <ArrowRight className="size-4" />
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">{t("empty")}</p>
      ) : (
        <ul className="divide-border divide-y">
          {rows.map((row, i) => (
            <li key={row.userId} className="flex items-center gap-3 py-2.5">
              <span className="w-5 flex-none text-center">
                {i < 3 ? (
                  <Medal className="mx-auto size-4" style={{ color: RANK_COLOR[i] }} />
                ) : (
                  <span className="text-muted-foreground text-sm">{i + 1}</span>
                )}
              </span>
              <span className="bg-primary/10 text-primary grid size-8 flex-none place-items-center rounded-full text-xs font-bold">
                {initialsFor(row)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{row.name ?? row.email ?? "—"}</p>
                <p className="text-muted-foreground text-xs">
                  {t("leaderboard.salesCount", { n: row.sales })}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display font-semibold tracking-tight tabular-nums">
                  {money.format(row.revenueCents / 100)}
                </p>
                <Badge variant="secondary" className="text-[0.625rem]">
                  {t(`role.${row.role}`)}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
