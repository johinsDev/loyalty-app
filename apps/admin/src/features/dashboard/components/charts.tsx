"use client";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@loyalty/ui";
import {
  Area,
  AreaChart as RAreaChart,
  Bar,
  BarChart as RBarChart,
  Cell,
  Pie,
  PieChart,
} from "recharts";

import type { EngagementSlice } from "../data";

// Charts on recharts via the @loyalty/ui ChartContainer (shadcn) — brand-themed,
// responsive, with tooltips. Wrappers keep simple series/slice props so the
// dashboard view stays declarative.

const toData = (series: number[]) => series.map((v, i) => ({ i, v }));

/** Tiny inline trend line for KPI cards (no axes/tooltip). */
export function Sparkline({
  series,
  trend = "up",
}: {
  series: number[];
  trend?: "up" | "down";
}) {
  const color = trend === "down" ? "#e0467c" : "var(--color-primary)";
  const config = { v: { label: "", color } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-8 w-22">
      <RAreaChart data={toData(series)} margin={{ top: 2, bottom: 2 }}>
        <defs>
          <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          dataKey="v"
          type="monotone"
          stroke={color}
          strokeWidth={2}
          fill="url(#spark)"
          dot={false}
          isAnimationActive={false}
        />
      </RAreaChart>
    </ChartContainer>
  );
}

/** Filled area chart for the larger trend cards, with a tooltip. */
export function AreaChart({
  series,
  color = "var(--color-primary)",
}: {
  series: number[];
  color?: string;
}) {
  const config = { v: { label: "", color } } satisfies ChartConfig;
  const id = `area-${color.replace(/[^a-z]/gi, "")}`;
  return (
    <ChartContainer config={config} className="aspect-auto size-full">
      <RAreaChart data={toData(series)} margin={{ top: 6, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Area
          dataKey="v"
          type="monotone"
          stroke={color}
          strokeWidth={3}
          fill={`url(#${id})`}
          dot={false}
        />
      </RAreaChart>
    </ChartContainer>
  );
}

/** Vertical bars (daily active users), with a tooltip. */
export function Bars({ series }: { series: number[] }) {
  const config = {
    v: { label: "", color: "var(--color-primary)" },
  } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto size-full">
      <RBarChart data={toData(series)} margin={{ top: 6, bottom: 0 }}>
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar
          dataKey="v"
          fill="var(--color-primary)"
          fillOpacity={0.55}
          radius={[3, 3, 0, 0]}
        />
      </RBarChart>
    </ChartContainer>
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
  const config = Object.fromEntries(
    slices.map((s) => [s.key, { label: s.key, color: s.color }]),
  ) satisfies ChartConfig;
  const data = slices.map((s) => ({ name: s.key, value: s.pct, fill: s.color }));
  return (
    <div className="relative size-40 flex-none">
      <ChartContainer config={config} className="aspect-square size-full">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="100%"
            strokeWidth={2}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-semibold">{center}</span>
        <span className="text-muted-foreground text-xs">{centerSub}</span>
      </div>
    </div>
  );
}
