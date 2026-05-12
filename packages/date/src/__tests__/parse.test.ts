import { describe, expect, test } from "vitest";

import { isToday, isValidDate, isYesterday, parseDate } from "../parse";

describe("parseDate", () => {
  test("null → null", () => expect(parseDate(null)).toBeNull());
  test("undefined → null", () => expect(parseDate(undefined)).toBeNull());
  test("empty string → null", () => expect(parseDate("")).toBeNull());
  test("garbage string → null", () => expect(parseDate("not a date")).toBeNull());
  test("ISO string parses", () => {
    const d = parseDate("2026-05-11T12:00:00Z");
    expect(d).toBeInstanceOf(Date);
    expect(d?.getUTCFullYear()).toBe(2026);
  });
  test("epoch ms parses", () => {
    const d = parseDate(1715472000000);
    expect(d).toBeInstanceOf(Date);
  });
  test("valid Date passes through", () => {
    const d = new Date("2026-05-11T12:00:00Z");
    expect(parseDate(d)).toBe(d);
  });
  test("Invalid Date instance → null", () => {
    expect(parseDate(new Date("definitely not a date"))).toBeNull();
  });
  test("plain objects → null", () => {
    expect(parseDate({} as unknown)).toBeNull();
    expect(parseDate([] as unknown)).toBeNull();
  });
});

describe("isValidDate", () => {
  test("rejects Invalid Date", () => {
    expect(isValidDate(new Date("not a date"))).toBe(false);
  });
  test("accepts real dates", () => {
    expect(isValidDate(new Date())).toBe(true);
  });
  test("rejects non-Date values", () => {
    expect(isValidDate("2026-05-11")).toBe(false);
    expect(isValidDate(1715472000000)).toBe(false);
    expect(isValidDate(null)).toBe(false);
  });
});

describe("isToday / isYesterday", () => {
  const now = new Date("2026-05-11T15:30:00.000-05:00");

  test("isToday with fixed clock", () => {
    expect(isToday(new Date("2026-05-11T08:00:00-05:00"), now)).toBe(true);
    expect(isToday(new Date("2026-05-10T23:59:59-05:00"), now)).toBe(false);
  });
  test("isYesterday with fixed clock", () => {
    expect(isYesterday(new Date("2026-05-10T08:00:00-05:00"), now)).toBe(true);
    expect(isYesterday(new Date("2026-05-11T00:00:00-05:00"), now)).toBe(false);
  });
});
