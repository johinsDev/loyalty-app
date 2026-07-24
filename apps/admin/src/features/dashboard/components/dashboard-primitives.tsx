import { Skeleton } from "@loyalty/ui";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { Sparkline } from "./charts";

/**
 * Server-renderable presentational primitives for the dashboard widgets. These
 * are prop-driven (no `useTranslations`/hooks) so they render inside server
 * components; the widgets pass already-translated strings. The client bits
 * (charts) are embedded as islands (e.g. {@link Sparkline} inside a KPI card).
 */
export function ChartCard({
  title,
  subtitle,
  badge,
  liveLabel,
  className = "",
  style,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  liveLabel?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      style={style}
      className={`bg-card border-border min-w-0 rounded-3xl border p-5 shadow-sm ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
            {liveLabel ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                {liveLabel}
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <p className="text-muted-foreground/80 mt-0.5 text-xs font-semibold">{subtitle}</p>
          ) : null}
        </div>
        {badge ? (
          <span className="bg-primary/10 text-primary rounded-full px-2.5 py-1 text-xs font-extrabold">
            {badge}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  sub,
  value,
  delta,
  trend,
  spark,
}: {
  label: string;
  sub: string;
  value: string;
  delta: string;
  trend: "up" | "down";
  spark: number[];
}) {
  const up = trend === "up";
  return (
    <div className="bg-card border-border rounded-3xl border p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="text-muted-foreground/70 text-xs font-extrabold tracking-wider uppercase">
          {label}
        </span>
        <Sparkline series={spark} trend={trend} />
      </div>
      <div className="font-display mt-1 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold">
        <span
          className={`inline-flex items-center gap-0.5 ${up ? "text-emerald-600" : "text-rose-500"}`}
        >
          {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
          {delta}
        </span>
        <span className="text-muted-foreground/70">· {sub}</span>
      </div>
    </div>
  );
}

export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-xl font-semibold">{value}</div>
      <div className="text-muted-foreground/70 text-xs font-semibold">{label}</div>
    </div>
  );
}

export function AvatarChip({ initials }: { initials: string }) {
  return (
    <span className="bg-primary/10 text-primary grid size-9 flex-none place-items-center rounded-full text-xs font-bold">
      {initials}
    </span>
  );
}

/** `<li>` skeleton rows for a list widget's `<Suspense>` fallback. */
export function ListSkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="divide-border divide-y">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 py-2.5">
          <Skeleton className="size-9 flex-none rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-3.5 w-12" />
        </li>
      ))}
    </ul>
  );
}

/** `<Suspense>` fallback for a card widget: the card frame + title paint
 *  instantly (matching the widget's own header), the body is a skeleton. */
export function CardSkeleton({
  title,
  className = "",
  bodyHeight = "h-40",
}: {
  title: string;
  className?: string;
  bodyHeight?: string;
}) {
  return (
    <ChartCard title={title} className={className}>
      <Skeleton className={`w-full rounded-xl ${bodyHeight}`} />
    </ChartCard>
  );
}

/** 4 KPI-card skeletons for the KPI row's `<Suspense>` fallback. */
export function KpiRowSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="bg-card border-border rounded-3xl border p-5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="mt-3 h-8 w-20" />
          <Skeleton className="mt-2 h-3 w-16" />
        </div>
      ))}
    </>
  );
}
