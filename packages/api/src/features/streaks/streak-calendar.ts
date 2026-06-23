// Pure calendar logic for streaks — no DB, fully testable. "Days" are local
// calendar dates (`YYYY-MM-DD`) in the store timezone; the streak counts only
// OPEN days and skips closed ones. All timezone math uses `Intl` (no deps), so
// it stays correct under any zone/offset.

import { STORE_HOURS, STORE_TZ, type DayHours } from "./config";

/** `YYYY-MM-DD` for the given instant in `tz` (en-CA renders ISO order). */
export function localDay(date: Date, tz: string = STORE_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Weekday (0 = Sun … 6 = Sat) of a pure `YYYY-MM-DD` calendar date. */
export function weekdayOf(day: string): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function hoursFor(day: string): DayHours | null {
  return STORE_HOURS[weekdayOf(day)] ?? null;
}

export function isOpenDay(day: string): boolean {
  return hoursFor(day) !== null;
}

/** Add `n` calendar days to a `YYYY-MM-DD` (n may be negative). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + n));
  return next.toISOString().slice(0, 10);
}

/** Count OPEN days strictly between `fromDay` and `toDay` (both exclusive).
 *  0 means they are adjacent open days (only closed days, if any, sit between)
 *  → the streak continues; >0 means an open day was missed → it breaks. */
export function openDaysBetween(fromDay: string, toDay: string): number {
  if (fromDay >= toDay) return 0;
  let count = 0;
  for (let d = addDays(fromDay, 1); d < toDay; d = addDays(d, 1)) {
    if (isOpenDay(d)) count += 1;
  }
  return count;
}

/** UTC instant of the store's close time on `day`, or null if closed. */
export function closeTimeFor(day: string): Date | null {
  const hours = hoursFor(day);
  if (!hours) return null;
  return zonedWallTimeToUtc(day, hours.close, STORE_TZ);
}

/** The most recent OPEN day whose close time has already passed at `now`.
 *  Used to detect a broken streak on read: if the last purchase day is older
 *  than this, an open day went by without a purchase. */
export function mostRecentPassedOpenDay(
  now: Date,
  tz: string = STORE_TZ,
): string | null {
  let day = localDay(now, tz);
  // Today counts as "passed" only once the store has closed.
  for (let i = 0; i < 14; i += 1) {
    if (isOpenDay(day)) {
      const close = closeTimeFor(day);
      if (close && close.getTime() <= now.getTime()) return day;
    }
    day = addDays(day, -1);
  }
  return null;
}

/** Convert a local wall-clock time on `day` ("HH:MM") in `tz` to a UTC instant.
 *  Works for any (incl. DST) zone by measuring the zone's offset at that instant. */
function zonedWallTimeToUtc(day: string, hhmm: string, tz: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const [hh, mm] = hhmm.split(":").map(Number) as [number, number];
  // Treat the wall-clock fields as if they were UTC, then subtract the zone's
  // offset at that moment to land on the real instant.
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  const offsetMs = tzOffsetMs(new Date(asUtc), tz);
  return new Date(asUtc - offsetMs);
}

/** Offset (ms) of `tz` from UTC at the given instant: `tzLocal - utc`. */
function tzOffsetMs(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - date.getTime();
}
