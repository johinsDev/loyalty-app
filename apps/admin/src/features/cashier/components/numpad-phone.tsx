"use client";

import {
  COUNTRIES,
  type CountryCode,
  formatNational,
  maxNationalLength,
  SUPPORTED_COUNTRIES,
} from "@loyalty/ui";
import { ChevronDown, Delete } from "lucide-react";

/** Numpad key layout — bottom row is [country-spacer, 0, backspace]. */
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", null, "0", "del"] as const;

/**
 * On-screen phone entry for the cashier terminal: a country picker (native
 * `<select>` overlaid on a styled chip), the number formatted as-you-type, and a
 * 0-9 numpad + backspace. Fully controlled — the parent owns `country` + the raw
 * national `digits` and derives validation via `toPhoneValue(digits, country)`.
 */
export function NumpadPhone({
  country,
  onCountryChange,
  digits,
  onDigitsChange,
  placeholder,
  countryLabel,
  backspaceLabel,
}: {
  country: CountryCode;
  onCountryChange: (c: CountryCode) => void;
  digits: string;
  onDigitsChange: (d: string) => void;
  placeholder: string;
  countryLabel: string;
  backspaceLabel: string;
}) {
  const def = COUNTRIES[country];
  const max = maxNationalLength(country);
  const national = formatNational(digits, country);

  const press = (key: string) => {
    if (key === "del") {
      onDigitsChange(digits.slice(0, -1));
      return;
    }
    if (digits.length >= max) return;
    onDigitsChange(digits + key);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Country + formatted number display. */}
      <div className="border-border bg-muted/40 flex items-center gap-2.5 rounded-2xl border p-2.5">
        <div className="relative shrink-0">
          <span className="border-border bg-card flex h-11 items-center gap-1.5 rounded-xl border pr-2 pl-2.5 text-sm font-extrabold">
            <def.Flag className="size-5 shrink-0 rounded-[2px]" />+{def.dialCode}
            <ChevronDown className="text-muted-foreground size-3.5" />
          </span>
          <select
            aria-label={countryLabel}
            value={country}
            onChange={(e) => onCountryChange(e.target.value as CountryCode)}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {SUPPORTED_COUNTRIES.map((code) => (
              <option key={code} value={code}>
                {code} +{COUNTRIES[code].dialCode}
              </option>
            ))}
          </select>
        </div>
        <div
          className={`font-display min-w-0 flex-1 truncate text-2xl font-semibold tabular-nums ${
            national ? "text-foreground" : "text-muted-foreground/50"
          }`}
        >
          {national || placeholder}
        </div>
      </div>

      {/* Numpad. */}
      <div className="grid grid-cols-3 gap-2.5">
        {KEYS.map((key) =>
          key === null ? (
            <span key="spacer" aria-hidden />
          ) : (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              aria-label={key === "del" ? backspaceLabel : undefined}
              className={`font-display grid h-16 place-items-center rounded-2xl text-2xl font-semibold tabular-nums transition active:scale-95 ${
                key === "del"
                  ? "text-muted-foreground hover:bg-muted"
                  : "border-border bg-card hover:border-primary/50 hover:bg-muted border"
              }`}
            >
              {key === "del" ? <Delete className="size-6" /> : key}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
