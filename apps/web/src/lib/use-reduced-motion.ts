"use client";

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Tracks the user's "reduce motion" OS/browser preference. Returns `true` when
 * motion should be minimized — counters jump to their final value, celebrations
 * are skipped, and staggered entrances render in place. Starts `false` so the
 * server and first client render agree (no hydration mismatch); it flips after
 * mount if the preference is set.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    setReduced(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
