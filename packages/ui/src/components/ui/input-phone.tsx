"use client";

import * as React from "react";
import PhoneInput, { type Props } from "react-phone-number-input/input";
import {
  type Country,
  type DefaultInputComponentProps,
  getCountries,
  getCountryCallingCode,
} from "react-phone-number-input";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "../../cn";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const INPUT_CLASSNAME =
  "h-8 w-full min-w-0 rounded-r-lg border border-l-0 border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80";

const PhoneInputAdapter = React.forwardRef<HTMLInputElement, DefaultInputComponentProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="tel"
      data-slot="input-phone-number"
      className={cn(INPUT_CLASSNAME, className)}
      {...props}
    />
  ),
);
PhoneInputAdapter.displayName = "PhoneInputAdapter";

function flagEmoji(country: string): string {
  return country
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join("");
}

const regionNamesEn = new Intl.DisplayNames(["en"], { type: "region" });
const regionNamesEs = new Intl.DisplayNames(["es"], { type: "region" });

function countryName(country: Country): string {
  return regionNamesEs.of(country) ?? regionNamesEn.of(country) ?? country;
}

type CountryEntry = {
  country: Country;
  dialCode: string;
  name: string;
  flag: string;
};

const COUNTRIES: ReadonlyArray<CountryEntry> = getCountries()
  .map((country) => ({
    country,
    dialCode: getCountryCallingCode(country),
    name: countryName(country),
    flag: flagEmoji(country),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

function CountrySelect({
  country,
  onChange,
  disabled,
}: {
  country: Country;
  onChange: (next: Country) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const dialCode = getCountryCallingCode(country);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        data-slot="input-phone-country"
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1 rounded-l-lg border border-input bg-transparent px-2 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:bg-input/30",
        )}
      >
        <span className="text-base leading-none" aria-hidden>
          {flagEmoji(country)}
        </span>
        <span className="text-muted-foreground tabular-nums">
          +{dialCode}
        </span>
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        className="w-[260px] p-0"
        align="start"
        sideOffset={4}
      >
        <Command>
          <CommandInput placeholder="Buscar país…" />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            {COUNTRIES.map((entry) => (
              <CommandItem
                key={entry.country}
                value={`${entry.name} ${entry.country} +${entry.dialCode}`}
                onSelect={() => {
                  onChange(entry.country);
                  setOpen(false);
                }}
              >
                <span className="text-base leading-none" aria-hidden>
                  {entry.flag}
                </span>
                <span className="flex-1 truncate">{entry.name}</span>
                <span className="text-muted-foreground tabular-nums text-xs">
                  +{entry.dialCode}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export type InputPhoneProps = Omit<
  Props<DefaultInputComponentProps>,
  "inputComponent" | "country" | "defaultCountry"
> & {
  defaultCountry?: Country;
  className?: string;
};

// Phone input with a country picker on the left (flag + dial code) and a
// formatter input on the right. `onChange` receives the E.164 string ready
// for Better Auth's phoneNumber plugin.
export function InputPhone({
  defaultCountry = "CO",
  value,
  onChange,
  disabled,
  className,
  ...props
}: InputPhoneProps) {
  const [country, setCountry] = React.useState<Country>(defaultCountry);

  return (
    <div className={cn("flex w-full", className)}>
      <CountrySelect
        country={country}
        onChange={setCountry}
        disabled={disabled}
      />
      <PhoneInput
        country={country}
        inputComponent={PhoneInputAdapter}
        value={value}
        onChange={onChange}
        disabled={disabled}
        {...props}
      />
    </div>
  );
}
