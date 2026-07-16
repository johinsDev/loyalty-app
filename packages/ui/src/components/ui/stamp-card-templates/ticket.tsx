"use client";

import { Gift } from "lucide-react";

import { cn } from "../../../cn";

import {
  onColorOf,
  PendingProgress,
  SpotPressArea,
  StampGrid,
  StampsPausedNotice,
} from "./shared";
import { StampIcon } from "./stamp-icon";
import type { StampCardView, StampSpot } from "./types";

const SPOT_BASE =
  "flex aspect-square w-full items-center justify-center rounded-xl transition-transform active:scale-95";

function TicketSpot({ view, spot }: { view: StampCardView; spot: StampSpot }) {
  if (spot.kind === "reward") {
    return (
      <SpotPressArea
        view={view}
        spot={spot}
        className={cn(SPOT_BASE, "bg-gradient-to-br from-amber-300 to-amber-500 text-white")}
        style={{ boxShadow: "0 0 14px 2px rgb(251 191 36 / 0.45)" }}
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
        className={cn(SPOT_BASE, "bg-white/95 shadow-md shadow-black/20")}
        style={{ color: onColorOf(view) }}
      >
        <StampIcon icon={view.icon} className="size-[45%]" />
      </SpotPressArea>
    );
  }
  return (
    <SpotPressArea
      view={view}
      spot={spot}
      className={cn(
        SPOT_BASE,
        view.offStyle === "dim"
          ? "bg-white/10 text-white/40"
          : "border-2 border-dashed border-white/40 bg-white/5 text-white/60",
      )}
    >
      {view.offStyle === "number" ? (
        <span className="font-mono text-xs font-bold">{spot.index}</span>
      ) : (
        <StampIcon icon={view.icon} className="size-[45%]" />
      )}
    </SpotPressArea>
  );
}

/** Template #8 — "Boleto": a literal punch card in the brand color — dashed
 *  tear line with notches, mono numbering, squared punch spots. */
export function TicketStampCard({ view }: { view: StampCardView }) {
  return (
    <section className="from-primary to-primary/80 shadow-primary/30 overflow-hidden rounded-2xl bg-gradient-to-r p-6 text-white shadow-xl">
      <div className="flex items-center justify-between">
        <span className="font-display text-xl font-semibold tracking-tight">
          {view.title}
        </span>
        <span className="rounded-full bg-black/15 px-3 py-1 font-mono text-xs font-extrabold whitespace-nowrap">
          {view.countLabel}
        </span>
      </div>
      <p
        className={`mt-1 text-xs font-semibold tracking-wider uppercase ${
          view.pausedLabel ? "text-white/45" : "text-white/80"
        }`}
      >
        {view.subtitle}
      </p>

      <div aria-hidden className="relative my-5 border-t-2 border-dashed border-white/40">
        <span className="bg-background absolute -top-[11px] -left-[34px] size-5 rounded-full" />
        <span className="bg-background absolute -top-[11px] -right-[34px] size-5 rounded-full" />
      </div>

      <StampGrid
        view={view}
        renderSpot={(spot) => <TicketSpot view={view} spot={spot} />}
      />
      <StampsPausedNotice view={view} light />
      <PendingProgress view={view} light />
    </section>
  );
}
