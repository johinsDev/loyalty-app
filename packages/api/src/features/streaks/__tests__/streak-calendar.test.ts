import { describe, expect, it } from "vitest";

import {
  addDays,
  closeTimeFor,
  isOpenDay,
  localDay,
  mostRecentPassedOpenDay,
  openDaysBetween,
  weekdayOf,
} from "../streak-calendar";

// Store timezone is America/Bogota (UTC-5, no DST). v1 config opens every day
// 10:00–21:00, so the closed-day branches are dormant; these cover the date math
// + the open-day-gap logic that the streak's continue/reset decision rides on.

describe("localDay (America/Bogota)", () => {
  it("rolls back across the UTC midnight to the local date", () => {
    // 02:30Z = 21:30 the previous day in Bogota.
    expect(localDay(new Date("2026-06-23T02:30:00Z"))).toBe("2026-06-22");
    // 18:00Z = 13:00 same day in Bogota.
    expect(localDay(new Date("2026-06-22T18:00:00Z"))).toBe("2026-06-22");
  });
});

describe("weekdayOf / addDays", () => {
  it("computes the weekday of a calendar date (0=Sun)", () => {
    expect(weekdayOf("2026-06-22")).toBe(1); // Monday
    expect(weekdayOf("2026-06-21")).toBe(0); // Sunday
  });

  it("adds and subtracts calendar days across month boundaries", () => {
    expect(addDays("2026-06-30", 1)).toBe("2026-07-01");
    expect(addDays("2026-07-01", -1)).toBe("2026-06-30");
  });
});

describe("openDaysBetween", () => {
  it("is 0 for adjacent days (streak continues)", () => {
    expect(openDaysBetween("2026-06-22", "2026-06-23")).toBe(0);
  });

  it("counts the open days skipped (streak breaks)", () => {
    // One full day (the 23rd) sits between → missed one open day.
    expect(openDaysBetween("2026-06-22", "2026-06-24")).toBe(1);
    expect(openDaysBetween("2026-06-22", "2026-06-25")).toBe(2);
  });

  it("is 0 when from >= to", () => {
    expect(openDaysBetween("2026-06-24", "2026-06-22")).toBe(0);
    expect(openDaysBetween("2026-06-22", "2026-06-22")).toBe(0);
  });
});

describe("isOpenDay / closeTimeFor", () => {
  it("treats every day as open in v1", () => {
    expect(isOpenDay("2026-06-21")).toBe(true); // Sunday, open in v1
  });

  it("resolves the local 21:00 close to the right UTC instant", () => {
    // 21:00 Bogota (UTC-5) = 02:00Z next day.
    expect(closeTimeFor("2026-06-22")?.toISOString()).toBe("2026-06-23T02:00:00.000Z");
  });
});

describe("mostRecentPassedOpenDay", () => {
  it("excludes today until the store has closed", () => {
    // Bogota 2026-06-22 20:00 (01:00Z next day) — before the 21:00 close.
    expect(mostRecentPassedOpenDay(new Date("2026-06-23T01:00:00Z"))).toBe(
      "2026-06-21",
    );
  });

  it("includes today once the store has closed", () => {
    // Bogota 2026-06-22 22:00 (03:00Z next day) — after the 21:00 close.
    expect(mostRecentPassedOpenDay(new Date("2026-06-23T03:00:00Z"))).toBe(
      "2026-06-22",
    );
  });
});
