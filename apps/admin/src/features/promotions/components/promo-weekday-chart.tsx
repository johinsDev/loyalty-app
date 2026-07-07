"use client";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@loyalty/ui";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

/** Promo applications by weekday — validates scheduling (weekday vs weekend). */
export function PromoWeekdayChart({
  data,
  label,
}: {
  data: { label: string; uses: number }[];
  label: string;
}) {
  const config = { uses: { label, color: "#7c5cff" } } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: 200 }}>
      <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }} barCategoryGap="24%">
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="uses" fill="#7c5cff" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
