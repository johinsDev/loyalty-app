"use client";

import * as React from "react";

import { balanceSizeClass, CountUp, PausedNotice, PressArea, TierIcon, usePrefersReducedMotion } from "./shared";
import type { PointsCardView } from "./types";

const RING_CIRCUMFERENCE = 427; // r=68 → 2πr

/** Template #1 — the original design: brand-tinted gradient card, progress
 *  ring around the balance, tier badge and a tier-to-tier bar. */
export function ClassicPointsCard({ view }: { view: PointsCardView }) {
  const reduced = usePrefersReducedMotion();
  const [filled, setFilled] = React.useState(false);
  React.useEffect(() => {
    if (reduced) {
      setFilled(true);
      return;
    }
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  const ringOffset = RING_CIRCUMFERENCE * (1 - (filled ? view.progress : 0));
  const balanceLabel = view.formatBalance(view.balance);

  return (
    <section className="from-primary/5 to-primary/20 shadow-primary/15 rounded-3xl bg-gradient-to-br p-7 shadow-xl">
      <PressArea
        view={view}
        className="flex w-full flex-col items-center transition-transform active:scale-[0.98]"
      >
        <div className="relative grid size-44 place-items-center">
          <svg viewBox="0 0 160 160" className="absolute inset-0 size-full" aria-hidden>
            <circle
              cx="80"
              cy="80"
              r="68"
              fill="none"
              strokeWidth="10"
              className="stroke-white/60 dark:stroke-white/10"
            />
            <circle
              cx="80"
              cy="80"
              r="68"
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              stroke={view.tierColor}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={ringOffset}
              transform="rotate(-90 80 80)"
              style={{
                transition: reduced ? undefined : "stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1)",
              }}
            />
          </svg>
          <div className="flex flex-col items-center">
            <span className={`font-display font-semibold tracking-tight ${balanceSizeClass(balanceLabel)}`}>
              <CountUp value={view.balance} format={view.formatBalance} />
            </span>
            <span className="text-muted-foreground -mt-0.5 inline-flex items-center gap-1 text-xs font-bold">
              <TierIcon iconKey={view.tierIconKey} className="size-3.5" style={{ color: view.tierColor }} />
              {view.tierName}
            </span>
          </div>
        </div>
        {view.pausedLabel ? (
          <PausedNotice view={view} />
        ) : (
          <p className="text-primary mt-4 mb-5 text-sm font-semibold">
            {view.nextLabel ?? view.maxLabel}
          </p>
        )}
      </PressArea>

      {!view.pausedLabel && view.nextTierName ? (
        <>
          <div className="mb-1.5 flex items-center justify-between text-xs font-bold whitespace-nowrap">
            <span className="text-foreground inline-flex items-center gap-1">
              <TierIcon iconKey={view.tierIconKey} className="size-3.5" style={{ color: view.tierColor }} />
              {view.tierName}
            </span>
            <span className="text-muted-foreground inline-flex items-center gap-1">
              {view.nextTierName}
              {view.nextThreshold != null ? ` · ${view.nextThreshold}` : ""}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/60 dark:bg-white/10">
            <div
              className="from-primary to-primary/40 h-full rounded-full bg-gradient-to-r"
              style={{
                width: `${(filled ? view.progress : 0) * 100}%`,
                transition: reduced ? undefined : "width 1.1s cubic-bezier(.22,1,.36,1)",
              }}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}
