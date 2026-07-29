"use client";

import { Button } from "@loyalty/ui";
import { unstable_catchError, type ErrorInfo } from "next/error";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/**
 * Per-island error boundary for suspending server components.
 *
 * The route-level `error.tsx` replaces the WHOLE store-scoped page on any widget
 * blip; this degrades a single island to a compact retry card and keeps the rest
 * of the page alive. Built on `unstable_catchError` (`next/error`, 16.2+) so
 * `unstable_retry` re-runs the failed RSC, and Next control-flow throws
 * (`notFound()` / `redirect()` / `unauthorized()`) pass through instead of being
 * swallowed as errors — which a plain `react-error-boundary` would get wrong.
 * Client-only: the API requires the client module graph.
 *
 * Wrap the island's `<Suspense>` (not its child) so it catches the throw:
 *   <IslandBoundary><Suspense fallback={<Skel/>}><Widget/></Suspense></IslandBoundary>
 *
 * Pass `label` to override the default "couldn't load this section" copy. Pass
 * `bare` for an island already nested inside a card frame (a dashboard
 * `ChartCard`) so the retry renders inline without doubling the border/rounding.
 */
type FallbackProps = { label?: ReactNode; bare?: boolean };

function IslandFallback({ label, bare }: FallbackProps, { unstable_retry }: ErrorInfo) {
  const t = useTranslations("Admin");
  return (
    <div
      className={
        bare
          ? "grid place-items-center gap-2 p-4 text-center"
          : "bg-card border-border grid place-items-center gap-2 rounded-3xl border p-6 text-center"
      }
    >
      <p className="text-muted-foreground text-sm">{label ?? t("errorBody")}</p>
      <Button variant="outline" size="sm" onClick={unstable_retry}>
        {t("errorRetry")}
      </Button>
    </div>
  );
}

export const IslandBoundary = unstable_catchError(IslandFallback);
