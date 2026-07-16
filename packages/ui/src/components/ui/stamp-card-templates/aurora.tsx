"use client";

import { motion } from "motion/react";

import {
  DefaultSpot,
  onColorOf,
  PendingProgress,
  StampGrid,
  StampsPausedNotice,
  usePrefersReducedMotion,
} from "./shared";
import type { StampCardView } from "./types";

/** Template #2 — "Aurora líquida": soft blobs of the stamp color drifting
 *  slowly behind a glassy card. Calm, premium. */
export function AuroraStampCard({ view }: { view: StampCardView }) {
  const reduced = usePrefersReducedMotion();
  const onColor = onColorOf(view);

  const drift = (dx: number, dy: number) =>
    reduced
      ? undefined
      : {
          x: [0, dx, -dx / 2, 0],
          y: [0, dy, -dy, 0],
          scale: [1, 1.15, 0.95, 1],
        };

  return (
    <section className="from-primary/10 via-background to-primary/5 relative overflow-hidden rounded-3xl bg-gradient-to-br p-6 shadow-xl shadow-black/10">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-10 -left-10 size-48 rounded-full opacity-30 blur-3xl"
        style={{ background: onColor }}
        animate={drift(40, 25)}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="bg-primary pointer-events-none absolute -right-12 -bottom-14 size-56 rounded-full opacity-25 blur-3xl"
        animate={drift(-35, -20)}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-display text-foreground text-xl font-semibold tracking-tight">
            {view.title}
          </span>
          <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-extrabold whitespace-nowrap backdrop-blur-sm">
            {view.countLabel}
          </span>
        </div>
        <p
          className={`mb-4 text-sm font-semibold ${
            view.pausedLabel ? "text-muted-foreground/60" : "text-muted-foreground"
          }`}
        >
          {view.subtitle}
        </p>
        <StampGrid
          view={view}
          renderSpot={(spot) => <DefaultSpot view={view} spot={spot} />}
        />
        <StampsPausedNotice view={view} />
        <PendingProgress view={view} />
      </div>
    </section>
  );
}
