"use client";

import {
  DefaultSpot,
  PendingProgress,
  StampGrid,
  StampsPausedNotice,
} from "./shared";
import type { StampCardView } from "./types";

/** Template #10 — "Minimal": flat editorial card — hairline ring, quiet type,
 *  no glow, the grid does all the talking. */
export function MinimalStampCard({ view }: { view: StampCardView }) {
  return (
    <section className="bg-card ring-border rounded-3xl p-7 shadow-sm ring-1">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-display text-foreground text-xl font-semibold tracking-tight">
          {view.title}
        </span>
        <span className="text-muted-foreground text-xs font-bold tracking-widest whitespace-nowrap uppercase">
          {view.countLabel}
        </span>
      </div>
      <p
        className={`mb-6 text-sm font-semibold ${
          view.pausedLabel ? "text-muted-foreground/60" : "text-muted-foreground"
        }`}
      >
        {view.subtitle}
      </p>
      <StampGrid
        view={view}
        renderSpot={(spot) => <DefaultSpot view={view} spot={spot} glow={false} />}
      />
      <StampsPausedNotice view={view} />
      <PendingProgress view={view} />
    </section>
  );
}
