import { describe, expect, test } from "vitest";

import {
  formatDate,
  formatDateRange,
  formatDateTime,
  formatRelative,
  formatTime,
} from "../format";

// Use local-time components so the wall-clock value (15:30 → "3:30 PM") is
// invariant across host timezones. An absolute UTC instant like
// `new Date("2026-05-11T15:30:00-05:00")` renders differently in Bogotá vs
// UTC and breaks tests on CI runners.
const D = new Date(2026, 4, 11, 15, 30, 0); // May 11, 2026 @ 15:30 local

describe("formatDate", () => {
  test("medium preset, es default → '11 may 2026'", () => {
    expect(formatDate(D)).toBe("11 may 2026");
  });
  test("medium preset, en → 'May 11, 2026'", () => {
    expect(formatDate(D, { locale: "en" })).toBe("May 11, 2026");
  });
  test("iso preset", () => {
    expect(formatDate(D, { preset: "iso" })).toBe("2026-05-11");
  });
  test("invalid input → empty string", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("")).toBe("");
    expect(formatDate("not a date")).toBe("");
  });
  test("Date instance passes through", () => {
    expect(formatDate(D)).toBe("11 may 2026");
  });
  test("number (epoch ms) parses", () => {
    expect(formatDate(D.getTime())).toBe("11 may 2026");
  });
});

describe("formatTime", () => {
  test("es-CO uses 12h (h:mm + AM/PM marker)", () => {
    // date-fns/locale/es ships `am`/`pm` for the `a` token (lowercase, no
    // spaces). True Colombian `p. m.` would require a custom dayPeriod
    // localizer — not worth the complexity until a stakeholder asks.
    const out = formatTime(D, { locale: "es" });
    expect(out.toLowerCase()).toContain("pm");
    expect(out).toMatch(/^3:30/);
  });
  test("en-US uses 12h with 'PM'", () => {
    expect(formatTime(D, { locale: "en" })).toBe("3:30 PM");
  });
});

describe("formatRelative", () => {
  test("recent past in es → 'hace ...'", () => {
    const now = new Date(D.getTime() + 3 * 60 * 1000); // 3 min later
    const out = formatRelative(D, { locale: "es", now });
    expect(out.toLowerCase()).toContain("hace");
  });
  test("recent past in en → '... ago'", () => {
    const now = new Date(D.getTime() + 3 * 60 * 1000);
    const out = formatRelative(D, { locale: "en", now });
    expect(out.toLowerCase()).toContain("ago");
  });
});

describe("formatDateTime", () => {
  test("medium preset combines date + time", () => {
    const out = formatDateTime(D, { locale: "es" });
    expect(out).toContain("11 may");
    expect(out.toLowerCase()).toContain("pm");
  });
});

describe("formatDateRange", () => {
  // Local-time noons keep the calendar day stable in any tz.
  const start = new Date(2026, 4, 11, 12, 0, 0);
  const sameMonth = new Date(2026, 4, 13, 12, 0, 0);
  const sameYear = new Date(2026, 5, 5, 12, 0, 0);
  const nextYear = new Date(2027, 0, 2, 12, 0, 0);

  test("same month collapses", () => {
    expect(formatDateRange(start, sameMonth, { locale: "es" })).toMatch(/^11 – 13 may 2026$/);
  });
  test("same year, different month", () => {
    expect(formatDateRange(start, sameYear, { locale: "es" })).toMatch(/^11 may – 5 jun 2026$/);
  });
  test("different year writes both years", () => {
    const out = formatDateRange(start, nextYear, { locale: "es" });
    expect(out).toContain("2026");
    expect(out).toContain("2027");
  });
  test("invalid input returns empty", () => {
    expect(formatDateRange(null, start)).toBe("");
    expect(formatDateRange(start, undefined)).toBe("");
  });
});
