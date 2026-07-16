"use client";

import { motion } from "motion/react";

import { CountUp, PausedNotice, PressArea, TierIcon, usePrefersReducedMotion } from "./shared";
import type { PointsCardView } from "./types";

/** Template #10 — "Minimal": flat editorial card — a huge brand-color number,
 *  a hairline progress rule, nothing else shouting. */
export function MinimalPointsCard({ view }: { view: PointsCardView }) {
  const reduced = usePrefersReducedMotion();

  return (
    <section className="bg-card ring-border rounded-3xl shadow-sm ring-1">
      <PressArea view={view} className="flex w-full flex-col p-7 text-left">
        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase">
          <TierIcon iconKey={view.tierIconKey} className="size-3.5" style={{ color: view.tierColor }} />
          {view.tierName}
        </span>
        <span className="font-display text-primary mt-2 text-6xl font-semibold tracking-tighter">
          <CountUp value={view.balance} format={view.formatBalance} />
        </span>
        {view.pausedLabel ? (
          <PausedNotice view={view} />
        ) : (
          <p className="text-muted-foreground mt-2 text-sm font-semibold">
            {view.nextLabel ?? view.maxLabel}
          </p>
        )}
        {!view.pausedLabel && view.nextTierName ? (
          <div className="mt-6">
            <div className="bg-border h-px w-full">
              <motion.div
                className="bg-primary h-px"
                initial={{ width: 0 }}
                animate={{ width: `${view.progress * 100}%` }}
                transition={reduced ? { duration: 0 } : { duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div className="text-muted-foreground mt-2 flex justify-between text-[0.7rem] font-bold">
              <span>{view.tierName}</span>
              <span>
                {view.nextTierName}
                {view.nextThreshold != null ? ` · ${view.nextThreshold}` : ""}
              </span>
            </div>
          </div>
        ) : null}
      </PressArea>
    </section>
  );
}
