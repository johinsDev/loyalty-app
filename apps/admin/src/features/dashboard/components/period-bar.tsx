"use client";

import { Button } from "@loyalty/ui";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { DASHBOARD_PERIODS } from "../list-params";

const SHALLOW = { shallow: false } as const;

/**
 * Dashboard period selector (7d/30d/90d) + export. The period lives in the URL
 * with `shallow:false`, so switching it re-runs the server render of every
 * widget hole. This is the only client island in the dashboard chrome.
 */
export function PeriodBar() {
  const t = useTranslations("Dashboard");
  const [period, setPeriod] = useQueryState(
    "period",
    parseAsStringLiteral(DASHBOARD_PERIODS).withDefault("30d").withOptions(SHALLOW),
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="bg-card border-border inline-flex rounded-full border p-1">
        {DASHBOARD_PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => void setPeriod(p)}
            className={`h-8 rounded-full px-4 text-sm font-bold transition-colors ${
              period === p
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            // Labelled "24h", not "hoy": it is a rolling window like the others,
            // so at 3pm it still counts yesterday's evening. Calling it "today"
            // would promise a calendar day the number isn't.
            title={p === "1d" ? t("period24hHint") : undefined}
          >
            {p === "1d" ? "24h" : p}
          </button>
        ))}
      </div>
      <Button variant="outline" className="h-10 gap-2 rounded-xl">
        <Download className="size-4" />
        {t("export")}
      </Button>
    </div>
  );
}
