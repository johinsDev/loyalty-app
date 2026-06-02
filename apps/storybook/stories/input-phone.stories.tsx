import { InputPhone, Label, type PhoneValue } from "@loyalty/ui";
import { useState } from "react";

const meta = {
  title: "Components/InputPhone",
  component: InputPhone,
  tags: ["autodocs"],
};
export default meta;

/** Default: Colombia, uncontrolled, showing the rich onChange payload. */
export const Default = {
  render: () => {
    const [v, setV] = useState<PhoneValue>();
    return (
      <div className="flex w-72 flex-col gap-2">
        <Label>Teléfono</Label>
        <InputPhone defaultCountry="CO" onChange={setV} placeholder="300 000 0000" />
        <pre className="rounded bg-muted p-2 text-[11px] leading-relaxed">
          {JSON.stringify(
            v && {
              e164: v.e164,
              formatted: v.formatted,
              country: v.countryCode,
              valid: v.isValid,
            },
            null,
            2,
          ) ?? "—"}
        </pre>
      </div>
    );
  },
};

/** Controlled by an E.164 string (hydrates country + national digits). */
export const Controlled = {
  render: () => {
    const [value, setValue] = useState<string>("+573005550000");
    return (
      <div className="flex w-72 flex-col gap-2">
        <Label>Teléfono</Label>
        <InputPhone
          value={value}
          onChange={(v) => setValue(v.e164)}
        />
        <span className="text-muted-foreground text-xs">value: {value || "—"}</span>
      </div>
    );
  },
};

/** Different default country (Mexico) — formatting + dial follow the country. */
export const DefaultCountryMX = {
  render: () => {
    const [v, setV] = useState<PhoneValue>();
    return (
      <div className="flex w-72 flex-col gap-2">
        <Label>Teléfono (MX)</Label>
        <InputPhone defaultCountry="MX" onChange={setV} />
        <span className="text-muted-foreground text-xs">E.164: {v?.e164 ?? "—"}</span>
      </div>
    );
  },
};

/** Limit + order the country list. */
export const LimitedCountries = {
  render: () => {
    const [v, setV] = useState<PhoneValue>();
    return (
      <div className="flex w-72 flex-col gap-2">
        <Label>Solo CO / PE</Label>
        <InputPhone defaultCountry="CO" countries={["CO", "PE"]} onChange={setV} />
        <span className="text-muted-foreground text-xs">E.164: {v?.e164 ?? "—"}</span>
      </div>
    );
  },
};

/** English country names via the `locale` prop. */
export const EnglishLabels = {
  render: () => {
    const [v, setV] = useState<PhoneValue>();
    return (
      <div className="flex w-72 flex-col gap-2">
        <Label>Phone</Label>
        <InputPhone defaultCountry="US" locale="en" onChange={setV} />
        <span className="text-muted-foreground text-xs">E.164: {v?.e164 ?? "—"}</span>
      </div>
    );
  },
};

/** Invalid number → consumer renders the error (validation is the form's job). */
export const Invalid = {
  render: () => {
    const [v, setV] = useState<PhoneValue>();
    const invalid = !!v && v.nationalNumber.length > 0 && !v.isValid;
    return (
      <div className="flex w-72 flex-col gap-2">
        <Label>Teléfono</Label>
        <InputPhone onChange={setV} aria-invalid={invalid} placeholder="300 000 0000" />
        {invalid ? (
          <span className="text-destructive text-xs">Número inválido</span>
        ) : null}
      </div>
    );
  },
};
