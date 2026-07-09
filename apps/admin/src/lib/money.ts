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
