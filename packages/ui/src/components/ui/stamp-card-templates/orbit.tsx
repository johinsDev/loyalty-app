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

/** Template #7 — "Órbita": satellites in the stamp color circling dashed
 *  orbit rings behind the corner of the card. */
export function OrbitStampCard({ view }: { view: StampCardView }) {
  const reduced = usePrefersReducedMotion();
  const onColor = onColorOf(view);

  return (
    <section className="from-primary/15 to-primary/5 relative overflow-hidden rounded-3xl bg-gradient-to-b p-6 shadow-xl shadow-black/10">
      <div aria-hidden className="pointer-events-none absolute -top-12 -right-12 size-44">
        <div className="border-primary/25 absolute inset-0 rounded-full border border-dashed" />
        <div className="border-primary/15 absolute inset-7 rounded-full border" />
        <motion.div
          className="absolute inset-0"
          animate={reduced ? undefined : { rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        >
          <span
            className="absolute top-0 left-1/2 size-2.5 -translate-x-1/2 rounded-full"
            style={{ background: onColor }}
          />
        </motion.div>
        <motion.div
          className="absolute inset-7"
          animate={reduced ? undefined : { rotate: -360 }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        >
          <span className="bg-primary/60 absolute top-0 left-1/2 size-1.5 -translate-x-1/2 rounded-full" />
        </motion.div>
      </div>

      <div className="relative z-10">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-display text-foreground text-xl font-semibold tracking-tight">
            {view.title}
          </span>
          <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-extrabold whitespace-nowrap">
            {view.countLabel}
          </span>
        </div>
        <p
          className={`mb-4 text-sm font-semibold ${
            view.pausedLabel ? "text-muted-foreground/60" : "text-primary"
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
