"use client";

import type { PromoStatPoint } from "@loyalty/api/features/promotions";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@loyalty/ui";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

/** Daily promo applications — single-series bars for the analytics section.
 *  Discount given lives in the KPIs + top table (different magnitude). */
export function PromoStatsChart({
  series,
  label,
  height = 224,
}: {
  series: PromoStatPoint[];
  label: string;
  height?: number;
}) {
  const config = { uses: { label, color: "#7c5cff" } } satisfies ChartConfig;
  const data = series.map((p) => ({ day: p.day.slice(5), uses: p.uses }));

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="uses" fill="#7c5cff" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
