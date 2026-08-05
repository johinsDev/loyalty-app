"use client";

import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { DASHBOARD_PERIODS } from "../list-params";

const DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

/**
 * A trend card's subtitle, with the scale the chart is actually drawn at.
 *
 * The 24h window is bucketed hourly (a day cut into days is one point, which
 * rendered as a lone dot), so the card has to say so — otherwise the same chart
 * silently means two different things depending on the selected period. The old
 * copy hardcoded "últimos 30 d" and lied on every other period.
 *
 * A client island like {@link PeriodBar}: the period lives in the URL, and
 * reading it on the server would need a top-level await that de-opts the
 * dashboard's static shell.
 */
export function SeriesSubtitle({ k }: { k: string }) {
  const t = useTranslations("Dashboard");
  const [period] = useQueryState(
    "period",
    parseAsStringLiteral(DASHBOARD_PERIODS).withDefault("30d"),
  );

  const scale =
    period === "1d"
      ? t("scaleHourly")
      : t("scaleDaily", { days: DAYS[period] ?? 30 });

  return (
    <>
      {t(k)} · <span className="font-semibold">{scale}</span>
    </>
  );
}
