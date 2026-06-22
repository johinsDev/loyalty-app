"use client";

import type { EngagementSlice } from "../data";

// Lightweight SVG/CSS chart primitives — no charting lib. They take normalized
// 0–100 series and render to the brand tokens, matching the t4-admin design.

function pointsFor(series: number[], w: number, h: number) {
  const max = Math.max(...series, 1);
  const step = w / (series.length - 1);
  return series.map((v, i) => [i * step, h - (v / max) * h] as const);
}

/** Tiny inline trend line for KPI cards. */
export function Sparkline({
  series,
  trend = "up",
}: {
  series: number[];
  trend?: "up" | "down";
}) {
  const w = 88;
  const h = 32;
  const pts = pointsFor(series, w, h);
  const d = pts.map((p) => p.join(",")).join(" ");
  const color = trend === "down" ? "#e0467c" : "var(--primary)";
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-8 w-22"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        points={d}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Filled area chart for the larger trend cards. */
export function AreaChart({
  series,
  color = "var(--primary)",
}: {
  series: number[];
  color?: string;
}) {
  const w = 600;
  const h = 200;
  const pts = pointsFor(series, w, h);
  const line = pts.map((p) => p.join(",")).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  const id = `area-${color.replace(/[^a-z]/gi, "")}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-full w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Vertical bars (daily active users). */
export function Bars({ series }: { series: number[] }) {
  const max = Math.max(...series, 1);
  return (
    <div className="flex h-full items-end gap-1">
      {series.map((v, i) => (
        <span
          key={i}
          className="bg-primary/55 min-w-0 flex-1 rounded-t-sm"
          style={{ height: `${(v / max) * 100}%` }}
        />
      ))}
    </div>
  );
}

/** Donut for the engagement (RFM) mix; center holds a score. */
export function Donut({
  slices,
  center,
  centerSub,
}: {
  slices: EngagementSlice[];
  center: string;
  centerSub: string;
}) {
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative size-40 flex-none">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        {slices.map((s) => {
          const len = (s.pct / 100) * c;
          const el = (
            <circle
              key={s.key}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={12}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-semibold">{center}</span>
        <span className="text-muted-foreground text-xs">{centerSub}</span>
      </div>
    </div>
  );
}
