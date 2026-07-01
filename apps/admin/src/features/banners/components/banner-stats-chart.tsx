"use client";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@loyalty/ui";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import type { BannerStatPoint } from "@loyalty/api/features/banners/schemas";

/** Daily impressions vs clicks — grouped bars for the banner detail + analytics. */
export function BannerStatsChart({
  series,
  labels,
}: {
  series: BannerStatPoint[];
  labels: { impressions: string; clicks: string };
}) {
  // Concrete hex fills (not theme vars) so the bars render regardless of how the
  // admin re-skin exposes `--color-*`.
  const config = {
    impressions: { label: labels.impressions, color: "#7c5cff" },
    clicks: { label: labels.clicks, color: "#e0467c" },
  } satisfies ChartConfig;

  const data = series.map((p) => ({
    day: p.day.slice(5), // MM-DD
    impressions: p.impressions,
    clicks: p.clicks,
  }));

  return (
    <ChartContainer
      config={config}
      className="aspect-auto w-full"
      style={{ height: 224 }}
    >
      <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="impressions" fill="#7c5cff" radius={[3, 3, 0, 0]} />
        <Bar dataKey="clicks" fill="#e0467c" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
