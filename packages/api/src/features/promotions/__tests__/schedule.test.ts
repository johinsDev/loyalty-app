import type { PromoSchedule } from "@loyalty/db/schema";
import { describe, expect, it } from "vitest";

import { isScheduleActiveAt } from "../engine";

// 2026-07-06 is a Monday. Bogota = fixed UTC-5.
const mondayAfternoon = new Date("2026-07-06T20:00:00Z"); // 15:00 local Mon

describe("isScheduleActiveAt", () => {
  it("is active with no schedule", () => {
    expect(isScheduleActiveAt(null, mondayAfternoon)).toBe(true);
  });

  it("weekly recurrence matches org-local weekday", () => {
    expect(
      isScheduleActiveAt({ recurrence: { kind: "weekly", days: [1] } }, mondayAfternoon),
    ).toBe(true);
    expect(
      isScheduleActiveAt({ recurrence: { kind: "weekly", days: [2] } }, mondayAfternoon),
    ).toBe(false);
  });

  it("flips weekday at Bogota midnight, not UTC midnight", () => {
    const lateMondayLocal = new Date("2026-07-07T04:59:00Z"); // Mon 23:59 local
    const earlyTuesdayLocal = new Date("2026-07-07T05:01:00Z"); // Tue 00:01 local
    const mondaysOnly: PromoSchedule = { recurrence: { kind: "weekly", days: [1] } };
    expect(isScheduleActiveAt(mondaysOnly, lateMondayLocal)).toBe(true);
    expect(isScheduleActiveAt(mondaysOnly, earlyTuesdayLocal)).toBe(false);
  });

  it("monthlyDay matches the local day of month (short months never match 31)", () => {
    expect(
      isScheduleActiveAt({ recurrence: { kind: "monthlyDay", day: 6 } }, mondayAfternoon),
    ).toBe(true);
    const april30 = new Date("2026-04-30T20:00:00Z");
    expect(isScheduleActiveAt({ recurrence: { kind: "monthlyDay", day: 31 } }, april30)).toBe(
      false,
    );
  });

  it("monthlyNthWeekday handles nth and last", () => {
    // 2026-07-06 is the first Monday of July.
    expect(
      isScheduleActiveAt(
        { recurrence: { kind: "monthlyNthWeekday", nth: 1, weekday: 1 } },
        mondayAfternoon,
      ),
    ).toBe(true);
    expect(
      isScheduleActiveAt(
        { recurrence: { kind: "monthlyNthWeekday", nth: 2, weekday: 1 } },
        mondayAfternoon,
      ),
    ).toBe(false);
    // 2026-07-27 is the last Monday of July.
    const lastMonday = new Date("2026-07-27T20:00:00Z");
    expect(
      isScheduleActiveAt(
        { recurrence: { kind: "monthlyNthWeekday", nth: -1, weekday: 1 } },
        lastMonday,
      ),
    ).toBe(true);
    expect(
      isScheduleActiveAt(
        { recurrence: { kind: "monthlyNthWeekday", nth: -1, weekday: 1 } },
        mondayAfternoon,
      ),
    ).toBe(false);
  });

  it("explicit dates and excluded dates use the org-local date", () => {
    expect(
      isScheduleActiveAt({ recurrence: { kind: "dates", dates: ["2026-07-06"] } }, mondayAfternoon),
    ).toBe(true);
    expect(
      isScheduleActiveAt({ recurrence: { kind: "dates", dates: ["2026-07-07"] } }, mondayAfternoon),
    ).toBe(false);
    expect(
      isScheduleActiveAt(
        { recurrence: { kind: "weekly", days: [1] }, excludedDates: ["2026-07-06"] },
        mondayAfternoon,
      ),
    ).toBe(false);
  });

  it("time windows are half-open and may span midnight", () => {
    const at1500 = mondayAfternoon;
    expect(isScheduleActiveAt({ timeWindow: { from: "15:00", to: "17:00" } }, at1500)).toBe(true);
    expect(isScheduleActiveAt({ timeWindow: { from: "17:00", to: "20:00" } }, at1500)).toBe(false);
    // 22:00–02:00 spans midnight: active at 23:00 local (04:00Z next day)…
    const at2300 = new Date("2026-07-07T04:00:00Z");
    expect(isScheduleActiveAt({ timeWindow: { from: "22:00", to: "02:00" } }, at2300)).toBe(true);
    // …and at 01:00 local, inactive at 15:00 local.
    const at0100 = new Date("2026-07-06T06:00:00Z");
    expect(isScheduleActiveAt({ timeWindow: { from: "22:00", to: "02:00" } }, at0100)).toBe(true);
    expect(isScheduleActiveAt({ timeWindow: { from: "22:00", to: "02:00" } }, at1500)).toBe(false);
  });
});
