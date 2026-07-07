import type { PromoSchedule } from "@loyalty/db/schema";

// The pilot org lives in America/Bogota — fixed UTC-5, no DST since 1993 — so
// a constant offset is exact and keeps the engine dependency-free. Swap this
// for a real tz lib (e.g. @date-fns/tz) when multi-timezone orgs arrive.
export const ORG_UTC_OFFSET_MINUTES = -300;

interface LocalParts {
  /** "YYYY-MM-DD" in org-local time. */
  dateKey: string;
  weekday: number; // 0 (Sun) – 6 (Sat)
  dayOfMonth: number; // 1–31
  daysInMonth: number;
  minutesOfDay: number;
}

export function toOrgLocalParts(nowUtc: Date): LocalParts {
  const local = new Date(nowUtc.getTime() + ORG_UTC_OFFSET_MINUTES * 60_000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    dateKey: `${y}-${pad(m + 1)}-${pad(d)}`,
    weekday: local.getUTCDay(),
    dayOfMonth: d,
    daysInMonth: new Date(Date.UTC(y, m + 1, 0)).getUTCDate(),
    minutesOfDay: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function recurrenceMatches(schedule: PromoSchedule, parts: LocalParts): boolean {
  const r = schedule.recurrence;
  if (!r) return true;
  switch (r.kind) {
    case "weekly":
      return r.days.includes(parts.weekday);
    case "monthlyDay":
      return parts.dayOfMonth === r.day;
    case "monthlyNthWeekday": {
      if (parts.weekday !== r.weekday) return false;
      if (r.nth === -1) return parts.dayOfMonth + 7 > parts.daysInMonth;
      return Math.ceil(parts.dayOfMonth / 7) === r.nth;
    }
    case "dates":
      return r.dates.includes(parts.dateKey);
    default:
      return false;
  }
}

function timeWindowMatches(schedule: PromoSchedule, parts: LocalParts): boolean {
  const w = schedule.timeWindow;
  if (!w) return true;
  const from = parseHm(w.from);
  const to = parseHm(w.to);
  const t = parts.minutesOfDay;
  if (from > to) return t >= from || t < to; // spans midnight
  return t >= from && t < to;
}

/** Whether the schedule DSL admits `nowUtc` (org-local). The startsAt/endsAt
 *  window is checked separately by eligibility. */
export function isScheduleActiveAt(schedule: PromoSchedule | null, nowUtc: Date): boolean {
  if (!schedule) return true;
  const parts = toOrgLocalParts(nowUtc);
  if (schedule.excludedDates?.includes(parts.dateKey)) return false;
  return recurrenceMatches(schedule, parts) && timeWindowMatches(schedule, parts);
}
