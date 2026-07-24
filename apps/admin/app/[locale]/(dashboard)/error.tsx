"use client";

import { Button } from "@loyalty/ui";
import { useTranslations } from "next-intl";

/**
 * Route-level error boundary for the admin dashboard: a Worker/data blip in any
 * store-scoped page degrades to a retry card instead of a crashed route. `reset`
 * re-renders the segment (re-runs the failed RSC).
 */
export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("Admin");
  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <div className="bg-card border-border max-w-md space-y-3 rounded-3xl border p-6 text-center shadow-sm">
        <h2 className="font-display text-lg font-semibold">{t("errorTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("errorBody")}</p>
        <Button onClick={reset}>{t("errorRetry")}</Button>
      </div>
    </div>
  );
}
