"use client";

import type { PromoStatPoint } from "@loyalty/api/features/promotions";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@loyalty/ui";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

/** Daily promo sales vs discount given (values in pesos) — the "worth it" ratio. */
export function PromoMoneyChart({
  series,
  labels,
}: {
  series: PromoStatPoint[];
  labels: { revenue: string; discount: string };
}) {
  const config = {
    revenue: { label: labels.revenue, color: "#1BAD9D" },
    discount: { label: labels.discount, color: "#e0467c" },
  } satisfies ChartConfig;

  const data = series.map((p) => ({
    day: p.day.slice(5), // MM-DD
    revenue: Math.round(p.revenueCents / 100),
    discount: Math.round(p.discountCents / 100),
  }));

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: 224 }}>
      <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }} barCategoryGap="20%">
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="revenue" fill="#1BAD9D" radius={[3, 3, 0, 0]} />
        <Bar dataKey="discount" fill="#e0467c" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
