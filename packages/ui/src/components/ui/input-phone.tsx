"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { CheckIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../../cn";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxList,
  ComboboxTrigger,
} from "./combobox";
import {
  COUNTRIES,
  type CountryCode,
  SUPPORTED_COUNTRIES,
} from "./input-phone.countries";
import {
  digitsOnly,
  formatNational,
  maxNationalLength,
  parseE164,
  type PhoneValue,
  toPhoneValue,
} from "./input-phone.lib";

const INPUT_CLASSNAME =
  "h-8 w-full min-w-0 rounded-r-lg border border-l-0 border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80";

function countryLabel(code: CountryCode, locale?: string): string {
  try {
    const dn = new Intl.DisplayNames([locale ?? "es"], { type: "region" });
    return dn.of(code) ?? code;
  } catch {
    return code;
  }
}

export interface InputPhoneProps
  extends Omit<
    React.ComponentProps<"input">,
    "value" | "defaultValue" | "onChange" | "type"
  > {
  /** Controlled value as E.164 (`+573122186181`). */
  value?: string;
  /** Uncontrolled initial value as E.164. */
  defaultValue?: string;
  /** Controlled selected country. */
  country?: CountryCode;
  /** Initial country when uncontrolled (default `"CO"`). */
  defaultCountry?: CountryCode;
  /** Receives the rich value on every change — pick `.e164` for auth. */
  onChange?: (value: PhoneValue) => void;
  onCountryChange?: (country: CountryCode) => void;
  /** Limit/order the country list. Defaults to all supported. */
  countries?: readonly CountryCode[];
  /** BCP-47 locale for country names (`Intl.DisplayNames`). Defaults to `es`. */
  locale?: string;
}

/**
 * Phone input: a Base-UI Combobox country picker (flag + dial code, searchable)
 * on the left and a country-aware masked `tel` input on the right. Emits the
 * rich {@link PhoneValue} via `onChange` (E.164 in `.e164` for Better Auth).
 * Controlled by an E.164 `value`, or uncontrolled with `defaultValue`.
 */
export function InputPhone({
  value,
  defaultValue,
  country: countryProp,
  defaultCountry = "CO",
  onChange,
  onCountryChange,
  countries = SUPPORTED_COUNTRIES,
  locale,
  className,
  disabled,
  ...inputProps
}: InputPhoneProps) {
  // Seed once from the initial prop (E.164 → country + national digits).
  const seed = React.useMemo(
    () => parseE164(value ?? defaultValue ?? ""),
    // biome-ignore lint/correctness/useExhaustiveDependencies: seed only on mount
    [],
  );
  const [countryState, setCountryState] = React.useState<CountryCode>(
    seed?.country ?? defaultCountry,
  );
  const [digits, setDigits] = React.useState<string>(seed?.nationalNumber ?? "");
  const [open, setOpen] = React.useState(false);

  const country = countryProp ?? countryState;

  // Keep internal state in sync when used as a controlled component.
  React.useEffect(() => {
    if (value === undefined) return;
    const parsed = parseE164(value);
    if (parsed) {
      setCountryState(parsed.country);
      setDigits(parsed.nationalNumber);
    } else {
      setDigits(digitsOnly(value).slice(0, maxNationalLength(country)));
    }
  }, [value, country]);

  const emit = (nextDigits: string, nextCountry: CountryCode) => {
    onChange?.(toPhoneValue(nextDigits, nextCountry));
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = digitsOnly(e.target.value).slice(0, maxNationalLength(country));
    setDigits(next);
    emit(next, country);
  };

  const handleCountry = (next: CountryCode | null) => {
    if (!next) return;
    if (!countryProp) setCountryState(next);
    onCountryChange?.(next);
    emit(digits, next);
    setOpen(false);
  };

  const def = COUNTRIES[country];
  const Flag = def.Flag;
  const display = formatNational(digits, country);

  return (
    <div className={cn("flex w-full", className)}>
      <Combobox
        items={[...countries]}
        value={country}
        onValueChange={(next) => handleCountry(next as CountryCode | null)}
        open={open}
        onOpenChange={setOpen}
        itemToStringLabel={(code: CountryCode) =>
          `${countryLabel(code, locale)} ${code} +${COUNTRIES[code].dialCode}`
        }
      >
        <ComboboxTrigger
          type="button"
          disabled={disabled}
          data-slot="input-phone-country"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-l-lg border border-input bg-transparent px-2 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:bg-input/30"
        >
          <Flag className="size-4 rounded-[2px]" />
          <span className="tabular-nums text-muted-foreground">
            +{def.dialCode}
          </span>
        </ComboboxTrigger>
        <ComboboxContent className="w-[260px]">
          <ComboboxInput placeholder="Buscar país…" showTrigger={false} />
          <ComboboxList>
            {(code: CountryCode) => {
              const c = COUNTRIES[code];
              const ItemFlag = c.Flag;
              return (
                <ComboboxPrimitive.Item
                  key={code}
                  value={code}
                  data-slot="combobox-item"
                  className="relative flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
                >
                  <ItemFlag className="size-4 shrink-0 rounded-[2px]" />
                  <span className="truncate">{countryLabel(code, locale)}</span>
                  <ComboboxPrimitive.ItemIndicator className="text-muted-foreground">
                    <CheckIcon className="size-3.5" />
                  </ComboboxPrimitive.ItemIndicator>
                  <span className="ml-auto tabular-nums text-muted-foreground text-xs">
                    +{c.dialCode}
                  </span>
                </ComboboxPrimitive.Item>
              );
            }}
          </ComboboxList>
          <ComboboxEmpty>Sin resultados.</ComboboxEmpty>
        </ComboboxContent>
      </Combobox>
      <input
        {...inputProps}
        type="tel"
        inputMode="numeric"
        autoComplete={inputProps.autoComplete ?? "tel"}
        maxLength={maxNationalLength(country) + 6}
        data-slot="input-phone-number"
        disabled={disabled}
        value={display}
        onChange={handleInput}
        className={INPUT_CLASSNAME}
      />
    </div>
  );
}
