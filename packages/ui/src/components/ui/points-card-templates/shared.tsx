"use client";

import { Crown, Flower2, Leaf, PauseCircle, Sparkles } from "lucide-react";
import * as React from "react";

import type { PointsCardView } from "./types";

const TIER_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  leaf: Leaf,
  flower: Flower2,
  crown: Crown,
};

export function TierIcon({
  iconKey,
  className,
  style,
}: {
  iconKey: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = TIER_ICONS[iconKey] ?? Sparkles;
  return <Icon className={className} style={style} />;
}

/** Shared reduced-motion check (templates freeze their loops when set). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** rAF count-up (easeOutCubic). Renders the final value immediately under
 *  reduced motion. Kept local to the templates — the web app has its own. */
export function CountUp({
  value,
  format,
  duration = 900,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = React.useState(0);
  React.useEffect(() => {
    if (reduced) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);
  return <>{format(shown)}</>;
}

/** Balance font size by rendered length so it never overflows its slot. */
export function balanceSizeClass(label: string): string {
  return label.length <= 5 ? "text-5xl" : label.length <= 7 ? "text-4xl" : "text-3xl";
}

/** The paused (redeem-only) notice, shared across templates. */
export function PausedNotice({ view, light = false }: { view: PointsCardView; light?: boolean }) {
  if (!view.pausedLabel) return null;
  return (
    <p
      className={`mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold ${
        light ? "text-white/70" : "text-muted-foreground"
      }`}
    >
      <PauseCircle className="size-4" />
      {view.pausedLabel}
    </p>
  );
}
