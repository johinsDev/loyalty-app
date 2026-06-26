/**
 * Pure helpers for the customer "Nuestra tienda" page. The store data now comes
 * from the API (`stores.listPublic`); this file keeps the open/closed status +
 * weekly-hours formatting (derived from hours against the request time) and the
 * keyless Google Maps deep links. `toHoursMap` adapts the API's per-day shape to
 * the weekday-indexed map these helpers expect.
 */

/** Minutes-from-midnight open/close window, in the store's local timezone. */
export type DayHours = { open: string; close: string } | null;

/** API hours (`Record<"0".."6", {open,close,closed}>`) → weekday-indexed map. */
export function toHoursMap(
  hours: Record<string, { open: string; close: string; closed: boolean }> | null,
): Record<number, DayHours> {
  const out: Record<number, DayHours> = {};
  for (let d = 0; d < 7; d += 1) {
    const h = hours?.[String(d)];
    out[d] = h && !h.closed ? { open: h.open, close: h.close } : null;
  }
  return out;
}

/** Monday-first display order over the JS weekday indices. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** Keyless Google Maps embed — no API key, free, shows a labelled pin. */
export const mapsEmbedUrl = (query: string) =>
  `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`;

/** Opens the place in Google Maps ("Ver en mapa"). */
export const mapsSearchUrl = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

export const telUrl = (phone: string) => `tel:${phone}`;

export const formatRange = (h: DayHours) => (h ? `${h.open} – ${h.close}` : null);

const toMinutes = (hm: string) => {
  const [h, m] = hm.split(":");
  return Number(h) * 60 + Number(m);
};

/** Weekday index + minutes-from-midnight for `now`, in the store's timezone. */
function localNow(now: Date, timezone: string): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const index: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = Number(get("hour")) % 24;
  return { weekday: index[get("weekday")] ?? 0, minutes: hour * 60 + Number(get("minute")) };
}

export type StoreStatus = {
  open: boolean;
  todayIndex: number;
  hint:
    | { kind: "closesAt"; time: string }
    | { kind: "opensAt"; time: string }
    | { kind: "opensDay"; time: string; dayIndex: number };
};

/** Whether the store is open right now + the hint shown next to the status. */
export function getStoreStatus(
  info: { timezone: string; hours: Record<number, DayHours> },
  now: Date,
): StoreStatus {
  const { weekday, minutes } = localNow(now, info.timezone);
  const today = info.hours[weekday];

  if (today) {
    const open = toMinutes(today.open);
    const close = toMinutes(today.close);
    if (minutes >= open && minutes < close) {
      return { open: true, todayIndex: weekday, hint: { kind: "closesAt", time: today.close } };
    }
    if (minutes < open) {
      return { open: false, todayIndex: weekday, hint: { kind: "opensAt", time: today.open } };
    }
  }

  for (let i = 1; i <= 7; i += 1) {
    const idx = (weekday + i) % 7;
    const next = info.hours[idx];
    if (next) {
      return { open: false, todayIndex: weekday, hint: { kind: "opensDay", time: next.open, dayIndex: idx } };
    }
  }
  return { open: false, todayIndex: weekday, hint: { kind: "opensAt", time: "" } };
}

/** Localized long weekday name for a JS weekday index (0 = Sunday). */
export function weekdayName(index: number, locale: string): string {
  const date = new Date(Date.UTC(2024, 0, 7 + index));
  return new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(date);
}
