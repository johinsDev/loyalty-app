import type { useFormatter } from "next-intl";

/** Format integer cents as a localized currency string (COP → 0 fraction
 *  digits, USD → 2). Mirrors the web `money` helper; admin had none. */
export function money(
  format: ReturnType<typeof useFormatter>,
  cents: number,
  currency = "COP",
): string {
  return format.number(cents / 100, {
    style: "currency",
    currency,
    useGrouping: "always",
  });
}

type Formatter = ReturnType<typeof useFormatter>;

const UNITS = [
  { limit: 1_000_000_000, suffix: "B" },
  { limit: 1_000_000, suffix: "M" },
  { limit: 1_000, suffix: "k" },
] as const;

/**
 * Abbreviate a large number: 1000 → "1k", 63 500 → "63,5k", 1 250 000 → "1,3M".
 * Hand-rolled rather than `notation: "compact"` because ICU is inconsistent
 * across locales (es-CO yields "1 K" but "63,5 k"). Use for aggregates in tight
 * tiles — never for an exact spendable balance.
 */
export function compactNumber(format: Formatter, value: number): string {
  const abs = Math.abs(value);
  const unit = UNITS.find((u) => abs >= u.limit);
  if (!unit) return format.number(value);
  const scaled = value / unit.limit;
  const digits = Math.abs(scaled) < 10 ? 1 : 0;
  return `${format.number(scaled, { maximumFractionDigits: digits })}${unit.suffix}`;
}

/**
 * `money` for tight spaces: abbreviates from a thousand up. Formats a zero and
 * swaps that digit for the abbreviation, so the currency keeps the locale's own
 * placement and spacing — `es` renders "400k COP", `en` renders "COP 400k".
 * Prefixing a bare symbol instead produced "COP400k", because `es` has no
 * narrow symbol for COP.
 */
export function compactMoney(format: Formatter, cents: number, currency = "COP"): string {
  const value = cents / 100;
  if (Math.abs(value) < 1000) return money(format, cents, currency);
  const template = format.number(0, { style: "currency", currency, maximumFractionDigits: 0 });
  return template.replace("0", compactNumber(format, value));
}
