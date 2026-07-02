"use client";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@loyalty/ui";
import type { CampaignSeriesPoint } from "@loyalty/api/features/campaigns/schemas";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

/** Daily sent / clicked / redeemed — grouped bars for the analytics + detail. */
export function CampaignStatsChart({
  series,
  labels,
}: {
  series: CampaignSeriesPoint[];
  labels: { sent: string; clicked: string; redeemed: string };
}) {
  // Concrete hex fills (not theme vars) so bars render regardless of the re-skin.
  const config = {
    sent: { label: labels.sent, color: "#7c5cff" },
    clicked: { label: labels.clicked, color: "#3b82f6" },
    redeemed: { label: labels.redeemed, color: "#14b8a6" },
  } satisfies ChartConfig;

  const data = series.map((p) => ({
    day: p.day.slice(5), // MM-DD
    sent: p.sent,
    clicked: p.clicked,
    redeemed: p.redeemed,
  }));

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: 224 }}>
      <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="sent" fill="#7c5cff" radius={[3, 3, 0, 0]} />
        <Bar dataKey="clicked" fill="#3b82f6" radius={[3, 3, 0, 0]} />
        <Bar dataKey="redeemed" fill="#14b8a6" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
