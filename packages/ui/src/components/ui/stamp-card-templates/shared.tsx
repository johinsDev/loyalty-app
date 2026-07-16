"use client";

import { Gift, PauseCircle } from "lucide-react";
import * as React from "react";

import { cn } from "../../../cn";

import { stampGridLayout } from "./layout";
import { StampIcon } from "./stamp-icon";
import type { StampCardView, StampSpot } from "./types";

export { usePrefersReducedMotion } from "../points-card-templates/shared";

/** The org's filled-stamp color (falls back to the brand primary). */
export function onColorOf(view: StampCardView): string {
  return view.onColor ?? "var(--primary)";
}

/** The spots this view renders, in order. Last spot is always the prize. */
export function spotsOf(view: StampCardView): StampSpot[] {
  const total = view.goal + 1;
  return Array.from({ length: total }, (_, i) => {
    const index = i + 1;
    const kind: StampSpot["kind"] =
      index === total ? "reward" : index <= view.filledInCycle ? "filled" : "empty";
    return { index, kind };
  });
}

/**
 * The shared grid engine: balanced rows from `stampGridLayout`, a shorter last
 * row centered. Templates own each spot's look via `renderSpot`; geometry stays
 * identical across all ten so every goal 3–12 reads deliberate.
 */
export function StampGrid({
  view,
  renderSpot,
  className,
  rowClassName,
}: {
  view: StampCardView;
  renderSpot: (spot: StampSpot) => React.ReactNode;
  className?: string;
  rowClassName?: string;
}) {
  const spots = spotsOf(view);
  const { cols, rows } = stampGridLayout(spots.length);
  let cursor = 0;
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {rows.map((count, rowIdx) => {
        const rowSpots = spots.slice(cursor, cursor + count);
        cursor += count;
        return (
          <div
            // Row identity is positional by design (rows never reorder).
            // eslint-disable-next-line react/no-array-index-key
            key={rowIdx}
            className={cn("flex justify-center gap-3", rowClassName)}
          >
            {rowSpots.map((spot) => (
              <div
                key={spot.index}
                // Full rows share the width evenly; a short centered row keeps
                // the same spot size by reusing the full-row basis.
                style={{ width: `calc((100% - ${(cols - 1) * 0.75}rem) / ${cols})` }}
              >
                {renderSpot(spot)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** One spot's pressable wrapper: a real <button> only when the view handles
 *  presses — gallery previews (no handler) get a <div>, so nesting inside the
 *  picker's own <button> stays valid HTML. */
export function SpotPressArea({
  view,
  spot,
  className,
  style,
  children,
}: {
  view: StampCardView;
  spot: StampSpot;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  if (!view.onSpotPress) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => view.onSpotPress?.(spot)}
      aria-label={view.spotAriaLabel(spot)}
      className={className}
      style={style}
    >
      {children}
    </button>
  );
}

/**
 * The default spot renderer (round). Honors the org's icon + on-color +
 * off-style; the reward spot keeps the Gift glyph with a warm glow. Templates
 * with their own chrome tune it via the class knobs instead of reimplementing
 * the states.
 */
export function DefaultSpot({
  view,
  spot,
  className,
  filledClassName,
  emptyClassName,
  rewardClassName,
  glow = true,
}: {
  view: StampCardView;
  spot: StampSpot;
  className?: string;
  filledClassName?: string;
  emptyClassName?: string;
  rewardClassName?: string;
  glow?: boolean;
}) {
  const onColor = onColorOf(view);
  const base =
    "flex aspect-square w-full items-center justify-center rounded-full transition-transform active:scale-95";

  if (spot.kind === "reward") {
    return (
      <SpotPressArea
        view={view}
        spot={spot}
        className={cn(
          base,
          "bg-gradient-to-br from-amber-300 to-amber-500 text-white",
          glow && "motion-safe:animate-pulse",
          className,
          rewardClassName,
        )}
        style={glow ? { boxShadow: "0 0 16px 2px rgb(251 191 36 / 0.55)" } : undefined}
      >
        <Gift className="size-[45%]" aria-hidden />
      </SpotPressArea>
    );
  }

  if (spot.kind === "filled") {
    return (
      <SpotPressArea
        view={view}
        spot={spot}
        className={cn(base, "text-white", className, filledClassName)}
        style={{ backgroundColor: onColor }}
      >
        <StampIcon icon={view.icon} className="size-[45%]" />
      </SpotPressArea>
    );
  }

  // Off styles stay brand-tinted so every template reads on-theme: `number`
  // is the legacy look (dashed ring + position number), `outline` swaps the
  // number for the dimmed glyph, `dim` drops the ring for a soft fill.
  return (
    <SpotPressArea
      view={view}
      spot={spot}
      className={cn(
        base,
        view.offStyle === "dim"
          ? "bg-primary/5 text-primary/35"
          : "border-primary/30 bg-primary/5 text-primary/50 border-2 border-dashed",
        className,
        emptyClassName,
      )}
    >
      {view.offStyle === "number" ? (
        <span className="text-xs font-bold">{spot.index}</span>
      ) : (
        <StampIcon icon={view.icon} className="size-[45%]" />
      )}
    </SpotPressArea>
  );
}

/** The paused (redeem-only) notice, shared across templates. */
export function StampsPausedNotice({
  view,
  light = false,
}: {
  view: StampCardView;
  light?: boolean;
}) {
  if (!view.pausedLabel) return null;
  return (
    <p
      className={cn(
        "mt-3 flex items-center justify-center gap-1.5 text-sm font-semibold",
        light ? "text-white/70" : "text-muted-foreground",
      )}
    >
      <PauseCircle className="size-4" />
      {view.pausedLabel}
    </p>
  );
}

/** "2/3 visits to your next stamp" — only when the org grants 1 per N > 1. */
export function PendingProgress({
  view,
  light = false,
}: {
  view: StampCardView;
  light?: boolean;
}) {
  if (!view.pendingLabel || !view.pending) return null;
  return (
    <p
      className={cn(
        "mt-2 text-center text-xs font-semibold",
        light ? "text-white/60" : "text-muted-foreground",
      )}
    >
      {view.pendingLabel}
    </p>
  );
}
