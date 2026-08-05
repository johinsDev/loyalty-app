import { describe, expect, it } from "vitest";

import {
  bucketCount,
  bucketKey,
  buildSeries,
  granularityFor,
  seriesStart,
  type SeriesRows,
} from "../series";

/** 2026-08-04 17:42 UTC — deliberately mid-hour, to catch alignment bugs. */
const NOW = new Date("2026-08-04T17:42:31.000Z");

const empty: SeriesRows = { purchases: [], redemptions: [], members: [] };
const rows = (over: Partial<SeriesRows>): SeriesRows => ({ ...empty, ...over });
const at = (iso: string) => new Date(iso);

describe("granularity", () => {
  it("cuts a one-day window into hours", () => {
    // The bug this guards: a day bucketed by day is one point, and the chart
    // rendered a single dot instead of a curve.
    expect(granularityFor("1d")).toBe("hour");
    expect(bucketCount("1d")).toBe(24);
  });

  it("keeps every longer window daily", () => {
    for (const p of ["7d", "30d", "90d"] as const) {
      expect(granularityFor(p)).toBe("day");
    }
    expect(bucketCount("7d")).toBe(7);
    expect(bucketCount("90d")).toBe(90);
  });
});

describe("seriesStart", () => {
  it("aligns the hourly window to the top of the hour", () => {
    // 24 buckets ending at 17:00 means the window opens at 18:00 the day before
    // — NOT at 17:42, which would read rows for an hour never drawn.
    expect(seriesStart("1d", NOW).toISOString()).toBe("2026-08-03T18:00:00.000Z");
  });

  it("aligns the daily window to midnight", () => {
    expect(seriesStart("7d", NOW).toISOString()).toBe("2026-07-29T00:00:00.000Z");
  });
});

describe("buildSeries", () => {
  it("returns one point per hour for a day, oldest first", () => {
    const points = buildSeries(empty, "1d", NOW);
    expect(points).toHaveLength(24);
    expect(points[0]?.date).toBe("2026-08-03T18");
    expect(points.at(-1)?.date).toBe("2026-08-04T17");
  });

  it("keeps quiet hours as zeros rather than gaps", () => {
    const points = buildSeries(
      rows({ purchases: [{ createdAt: at("2026-08-04T15:10:00Z"), priceCents: 1200 }] }),
      "1d",
      NOW,
    );
    expect(points).toHaveLength(24);
    expect(points.filter((p) => p.purchases > 0)).toHaveLength(1);
    expect(points.every((p) => typeof p.purchases === "number")).toBe(true);
  });

  it("puts each row in the hour it happened", () => {
    const points = buildSeries(
      rows({
        purchases: [
          { createdAt: at("2026-08-04T15:00:00Z"), priceCents: 1000 },
          { createdAt: at("2026-08-04T15:59:59Z"), priceCents: 500 },
          { createdAt: at("2026-08-04T16:00:00Z"), priceCents: 300 },
        ],
      }),
      "1d",
      NOW,
    );
    const byHour = Object.fromEntries(points.map((p) => [p.date, p]));
    expect(byHour["2026-08-04T15"]).toMatchObject({ purchases: 2, revenueCents: 1500 });
    expect(byHour["2026-08-04T16"]).toMatchObject({ purchases: 1, revenueCents: 300 });
  });

  it("counts the current partial hour", () => {
    // 17:42 belongs to the 17:00 bucket — the newest point must not be dead.
    const points = buildSeries(
      rows({ redemptions: [{ createdAt: at("2026-08-04T17:40:00Z") }] }),
      "1d",
      NOW,
    );
    expect(points.at(-1)).toMatchObject({ date: "2026-08-04T17", redemptions: 1 });
  });

  it("drops rows older than the window instead of folding them into hour 0", () => {
    const points = buildSeries(
      rows({ members: [{ createdAt: at("2026-08-03T17:59:00Z") }] }),
      "1d",
      NOW,
    );
    expect(points.reduce((n, p) => n + p.members, 0)).toBe(0);
  });

  it("still buckets longer periods by day", () => {
    const points = buildSeries(
      rows({
        purchases: [
          { createdAt: at("2026-08-04T02:00:00Z"), priceCents: 100 },
          { createdAt: at("2026-08-04T23:00:00Z"), priceCents: 100 },
        ],
      }),
      "7d",
      NOW,
    );
    expect(points).toHaveLength(7);
    expect(points.at(-1)).toMatchObject({ date: "2026-08-04", purchases: 2 });
  });

  it("sums every metric independently", () => {
    const points = buildSeries(
      rows({
        purchases: [{ createdAt: at("2026-08-04T17:00:00Z"), priceCents: 900 }],
        redemptions: [{ createdAt: at("2026-08-04T17:05:00Z") }],
        members: [{ createdAt: at("2026-08-04T17:10:00Z") }],
      }),
      "1d",
      NOW,
    );
    expect(points.at(-1)).toEqual({
      date: "2026-08-04T17",
      purchases: 1,
      redemptions: 1,
      members: 1,
      revenueCents: 900,
    });
  });
});

describe("bucketKey", () => {
  it("keys hours to the hour and days to the day", () => {
    expect(bucketKey(at("2026-08-04T17:42:31Z"), "hour")).toBe("2026-08-04T17");
    expect(bucketKey(at("2026-08-04T17:42:31Z"), "day")).toBe("2026-08-04");
  });
});
