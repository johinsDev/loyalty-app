/**
 * Single-store config for the customer "Nuestra tienda" page — a faithful build
 * of the `isSingle` branch of the "T4 · Ubicaciones" Claude Design template.
 *
 * The pilot runs in one physical T4 shop, so the store is hardcoded here (name,
 * address, phone, geo + weekly hours in the store's timezone). When the
 * multi-location API/DB lands this file becomes the seam: swap the constant for
 * a fetch and the page renders unchanged. Open/closed status and "today" are
 * derived from these hours against the request time (see {@link getStoreStatus}).
 */

/** Minutes-from-midnight open/close window, in the store's local timezone. */
export type DayHours = { open: string; close: string } | null;

export type Store = {
  name: string;
  address: string;
  /** E.164, for the `tel:` link. */
  phone: string;
  /** Human-readable, for display. */
  phoneDisplay: string;
  /** IANA timezone the hours are expressed in. */
  timezone: string;
  /** Hours keyed by JS weekday index (0 = Sunday … 6 = Saturday). */
  hours: Record<number, DayHours>;
};

export const store: Store = {
  name: "T4 Centro",
  address: "Cra 7 #45-12, Bogotá",
  phone: "+5716000001",
  phoneDisplay: "+57 1 600 0001",
  timezone: "America/Bogota",
  hours: {
    0: { open: "12:00", close: "20:00" }, // Sunday
    1: { open: "10:00", close: "21:00" },
    2: { open: "10:00", close: "21:00" },
    3: { open: "10:00", close: "21:00" },
    4: { open: "10:00", close: "21:00" },
    5: { open: "10:00", close: "22:00" }, // Friday
    6: { open: "11:00", close: "22:00" }, // Saturday
  },
};

/** Monday-first display order over the JS weekday indices. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const mapsQuery = (s: Store) => `${s.name}, ${s.address}`;

/** Keyless Google Maps embed — no API key, free, shows a labelled pin. */
export const mapsEmbedUrl = (s: Store) =>
  `https://maps.google.com/maps?q=${encodeURIComponent(mapsQuery(s))}&z=16&output=embed`;

/** Opens the place in Google Maps ("Ver en mapa"). */
export const mapsSearchUrl = (s: Store) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery(s))}`;

/** Turn-by-turn directions to the store ("Cómo llegar"). */
export const mapsDirectionsUrl = (s: Store) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsQuery(s))}`;

export const telUrl = (s: Store) => `tel:${s.phone}`;

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
  const index: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const hour = Number(get("hour")) % 24; // some runtimes emit "24" at midnight
  return { weekday: index[get("weekday")] ?? 0, minutes: hour * 60 + Number(get("minute")) };
}

export type StoreStatus = {
  open: boolean;
  /** JS weekday index (0–6) of "today" in the store's timezone. */
  todayIndex: number;
  /** Drives the localized hint copy: closes-at / opens-at / opens-on-day. */
  hint:
    | { kind: "closesAt"; time: string }
    | { kind: "opensAt"; time: string }
    | { kind: "opensDay"; time: string; dayIndex: number };
};

/**
 * Whether the store is open right now, plus the hint shown next to the status:
 * "Cierra 21:00" when open, "Abre 11:00" when it opens later today, or
 * "Abre Lunes 10:00" pointing at the next open day.
 */
export function getStoreStatus(s: Store, now: Date): StoreStatus {
  const { weekday, minutes } = localNow(now, s.timezone);
  const today = s.hours[weekday];

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

  // Closed for the rest of today — find the next day that has hours.
  for (let i = 1; i <= 7; i++) {
    const idx = (weekday + i) % 7;
    const next = s.hours[idx];
    if (next) {
      return {
        open: false,
        todayIndex: weekday,
        hint: { kind: "opensDay", time: next.open, dayIndex: idx },
      };
    }
  }
  return { open: false, todayIndex: weekday, hint: { kind: "opensAt", time: "" } };
}

/** Localized long weekday name for a JS weekday index (0 = Sunday). */
export function weekdayName(index: number, locale: string): string {
  // 2024-01-07 is a Sunday; offset by the index to land on the wanted weekday.
  const date = new Date(Date.UTC(2024, 0, 7 + index));
  return new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(date);
}
