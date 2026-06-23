// Streak feature config — hardcoded for the pilot. Every value here becomes
// admin-/store-configurable later (a `store_hours` table + per-org settings);
// this file is the single seam where that swap happens.

/** Consecutive OPEN days with a purchase needed to win the reward. */
export const STREAK_GOAL_DAYS = 5;

/** Store timezone — the day boundary + close times are computed in this zone. */
export const STORE_TZ = "America/Bogota";

export interface DayHours {
  /** Local wall-clock "HH:MM". */
  open: string;
  close: string;
}

// Weekly schedule keyed by weekday (0 = Sunday … 6 = Saturday). `null` = closed.
// v1: open every day 10:00–21:00. Closed days are skipped by the streak (they
// neither advance nor break it).
export const STORE_HOURS: Record<number, DayHours | null> = {
  0: { open: "10:00", close: "21:00" },
  1: { open: "10:00", close: "21:00" },
  2: { open: "10:00", close: "21:00" },
  3: { open: "10:00", close: "21:00" },
  4: { open: "10:00", close: "21:00" },
  5: { open: "10:00", close: "21:00" },
  6: { open: "10:00", close: "21:00" },
};

/** Master switch + lead time for the "you're about to lose your streak" nudge. */
export const REMINDER_ENABLED = true;
export const REMINDER_HOURS_BEFORE = 4;
