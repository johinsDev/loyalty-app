import { PERIOD_DAYS, type DashboardSeriesPoint, type Period } from "./schemas";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * How a period is cut into chart points.
 *
 * A day-long window cut into days is a single bucket, and a line chart with one
 * point renders as a lone dot — which is what the 24h dashboard showed. Below a
 * day the useful unit is the hour; above it, more than ~90 points is noise, so
 * everything else stays daily.
 */
export type Granularity = "hour" | "day";

export function granularityFor(period: Period): Granularity {
  return period === "1d" ? "hour" : "day";
}

export function bucketCount(period: Period): number {
  return period === "1d" ? 24 : PERIOD_DAYS[period];
}

/** Bucket key. UTC throughout, matching the rest of the dashboard's aggregates. */
export function bucketKey(at: Date, granularity: Granularity): string {
  const iso = at.toISOString();
  // "2026-08-04T17" for hours, "2026-08-04" for days.
  return granularity === "hour" ? iso.slice(0, 13) : iso.slice(0, 10);
}

/** Truncates to the start of the bucket `at` falls in. */
function floorTo(at: Date, granularity: Granularity): Date {
  const ms = granularity === "hour" ? HOUR_MS : DAY_MS;
  return new Date(Math.floor(at.getTime() / ms) * ms);
}

/**
 * First instant the window covers, aligned to a bucket boundary.
 *
 * Aligned rather than "exactly N units ago" so the query doesn't fetch rows
 * that belong to a bucket the chart never draws — with an unaligned start, the
 * oldest partial hour would be silently dropped after being read.
 */
export function seriesStart(period: Period, now: Date): Date {
  const granularity = granularityFor(period);
  const unit = granularity === "hour" ? HOUR_MS : DAY_MS;
  return new Date(
    floorTo(now, granularity).getTime() - (bucketCount(period) - 1) * unit,
  );
}

export interface SeriesRows {
  purchases: { createdAt: Date; priceCents: number }[];
  redemptions: { createdAt: Date }[];
  members: { createdAt: Date }[];
}

/**
 * Fold rows into one point per bucket, pre-seeding the whole window so the
 * chart has no gaps (a quiet hour is a zero, not a missing point).
 *
 * Pure on purpose: the bucketing is where off-by-one and boundary bugs hide,
 * and this is the repo's only way to test that without a DB harness.
 */
export function buildSeries(
  rows: SeriesRows,
  period: Period,
  now: Date,
): DashboardSeriesPoint[] {
  const granularity = granularityFor(period);
  const unit = granularity === "hour" ? HOUR_MS : DAY_MS;
  const start = seriesStart(period, now);

  type Bucket = Omit<DashboardSeriesPoint, "date">;
  const buckets = new Map<string, Bucket>();
  for (let i = 0; i < bucketCount(period); i++) {
    buckets.set(bucketKey(new Date(start.getTime() + i * unit), granularity), {
      purchases: 0,
      redemptions: 0,
      members: 0,
      revenueCents: 0,
    });
  }

  for (const p of rows.purchases) {
    const b = buckets.get(bucketKey(p.createdAt, granularity));
    if (b) {
      b.purchases += 1;
      b.revenueCents += p.priceCents;
    }
  }
  for (const r of rows.redemptions) {
    const b = buckets.get(bucketKey(r.createdAt, granularity));
    if (b) b.redemptions += 1;
  }
  for (const c of rows.members) {
    const b = buckets.get(bucketKey(c.createdAt, granularity));
    if (b) b.members += 1;
  }

  return [...buckets.entries()].map(([date, v]) => ({ date, ...v }));
}
