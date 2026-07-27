"use client";

import { parseAsString, useQueryStates } from "nuqs";
import { type ReactNode, Suspense, useMemo } from "react";

/**
 * A `<Suspense>` keyed on a set of URL params, read via **nuqs** so the route
 * stays PPR-safe — a raw `useSearchParams()` opts the whole route into dynamic
 * rendering and kills the static shell that makes navigation instant.
 *
 * Why it exists: nuqs commits param changes through a router *transition*, and
 * React keeps an already-revealed Suspense boundary mounted across a transition
 * — so the fallback never re-shows and the skeleton doesn't flash on a filter
 * change. Keying the boundary on the watched params **remounts** it whenever
 * they change, and a freshly-mounted boundary always shows its fallback. Net:
 * the skeleton re-appears on every watched-param change while the server streams
 * the new rows.
 *
 * Pass only the FILTER params — leave out `page`/`sort` so pagination and
 * sorting keep the current rows (their transition stays smooth) while filters
 * flash the skeleton. `watch` must be a stable (module-level) array.
 */
export function KeyedSuspense({
  watch,
  fallback,
  children,
}: {
  watch: readonly string[];
  fallback: ReactNode;
  children: ReactNode;
}) {
  const parsers = useMemo(
    () => Object.fromEntries(watch.map((k) => [k, parseAsString])),
    [watch],
  );
  const [state] = useQueryStates(parsers);
  const key = watch.map((k) => `${k}:${state[k] ?? ""}`).join("|");
  return (
    <Suspense key={key} fallback={fallback}>
      {children}
    </Suspense>
  );
}
