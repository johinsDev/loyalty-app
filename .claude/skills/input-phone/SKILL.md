---
name: input-phone
description: The first-party phone input in `@loyalty/ui` (`InputPhone`) — our own country list + flags + country-aware masking + libphonenumber-js validation, with a Base-UI Combobox country picker. Use when adding a phone field, wiring it into a form (react-hook-form Controller) or auth, adding/removing a supported country or changing its mask, translating country names, or debugging the emitted value. We do NOT use react-phone-number-input. Pairs with `zod`, `react-hook-form`, `ui`, `icons`.
---

# input-phone

`InputPhone` (`@loyalty/ui`) is our own phone field — no `react-phone-number-input`. It's a Base-UI **Combobox** country picker (flag + dial code, searchable) + a country-aware masked `tel` input. Validation/formatting come from **libphonenumber-js** (Google's library, JS port). It emits a rich `PhoneValue`; the consumer picks what it needs (auth uses `.e164`).

## Where things live

| What | Where |
| --- | --- |
| Component | `packages/ui/src/components/ui/input-phone.tsx` |
| Pure logic (tested) | `packages/ui/src/components/ui/input-phone.lib.ts` |
| Country list (edit here) | `packages/ui/src/components/ui/input-phone.countries.ts` |
| Flags (SVG) | `packages/ui/src/icons/flags.tsx` |
| Unit tests | `packages/ui/src/components/ui/__tests__/input-phone.lib.test.ts` |
| Stories | `apps/storybook/stories/input-phone.stories.tsx` |
| Auth usage | `apps/web/src/features/auth/components/sign-in-form.tsx` |

## The emitted value

`onChange` receives a `PhoneValue` — **not** a string — so the dev chooses:
```ts
interface PhoneValue {
  e164: string;          // "+573122186181"  ← use this for Better Auth
  national: string;      // "(312) 218 6181"
  formatted: string;     // "+57 (312) 218 6181"
  countryCode: CountryCode;
  dialCode: string;      // "57"
  nationalNumber: string;// "3122186181"
  isValid: boolean;      // full libphonenumber validation
  isPossible: boolean;   // length-plausible
}
```
The `value` prop (controlled) is an **E.164 string** — it hydrates the country + digits. Uncontrolled: pass `defaultValue` (E.164) or just `defaultCountry`, and read `onChange`.

## Usage

**Uncontrolled (simplest):**
```tsx
<InputPhone defaultCountry="CO" onChange={(v) => console.log(v.e164)} />
```

**With react-hook-form (Controller — the standard) + Zod:**
```tsx
import { isValidE164Phone } from "@loyalty/ui";
const schema = z.object({ phone: z.string().refine(isValidE164Phone, "Invalid") });
// ...
<Controller
  control={control}
  name="phone"
  render={({ field }) => (
    <InputPhone
      value={field.value}
      onChange={(v) => field.onChange(v.e164)} // store E.164
      onBlur={field.onBlur}
      locale={locale}
      aria-invalid={!!errors.phone}
    />
  )}
/>
```
Auth (`sign-in-form.tsx`) does exactly this and hands `.e164` to `authClient.phoneNumber.sendOtp`.

## Props

`value?` (E.164, controlled) · `defaultValue?` (E.164) · `country?` / `defaultCountry="CO"` (controllable) · `onChange?(v: PhoneValue)` · `onCountryChange?` · `countries?: CountryCode[]` (limit/order) · `locale?` (country names via `Intl.DisplayNames`, defaults `es`) · plus standard input props (`placeholder`, `disabled`, `aria-invalid`, `id`, …). The input is `type="tel" inputMode="numeric"` (numeric keyboard), strips non-digits, and caps length per country.

## Adding / removing a country (req: easy + limited)

1. Add a flag in `icons/flags.tsx` (a small 4:3 SVG component).
2. Add the code to `CountryCode`, `SUPPORTED_COUNTRIES`, `FLAGS`, and `NATIONAL_DIGITS` in `input-phone.countries.ts`.
That's it — dial code is pulled from libphonenumber. Supported today: `CO US CA MX CR PE` (CO default).

## Masking (req: configurable)

By default formatting uses libphonenumber's `AsYouType` national format (`(312) 128 6181`). To force a specific mask for a country, set `mask` in the `MASKS` map in `input-phone.countries.ts` (`#` = a digit, other chars literal):
```ts
const MASKS: Partial<Record<CountryCode, string>> = { CO: "(###) ###-####" };
```

## Translations (country names)

The component is framework-agnostic — it uses `Intl.DisplayNames(locale)`. Pass `locale` (e.g. from next-intl's `useLocale()`); names localize automatically. No string tables to maintain.

## Validation

Use the exported `isValidE164Phone(e164)` (wraps libphonenumber's `isValidPhoneNumber`) in your Zod schema. The component itself never blocks input — validation is the form's job (so errors render where you want). `PhoneValue.isValid` / `.isPossible` are also available for inline UI.

## Common tasks

| Goal | Do |
| --- | --- |
| Phone field in a form | `Controller` + `InputPhone`, store `v.e164`, validate with `isValidE164Phone` |
| Add a country | flag in `flags.tsx` + entry in `input-phone.countries.ts` |
| Change a country's format | add a `mask` in `MASKS` |
| Limit the picker | `countries={["CO","PE"]}` |
| Localize names | pass `locale` |
| Test the logic | `bun --cwd packages/ui run test` (`input-phone.lib.test.ts`) |

## Why our own

`react-phone-number-input` bundles its own (huge) country/flag UI we can't restyle to the design system. Owning a thin component over `libphonenumber-js` (just the formatting/validation engine) + our Combobox + our flags gives a Base-UI-consistent picker, a small editable country set, configurable masks, and a value shape (`PhoneValue`) tailored to our forms + auth — with the logic unit-tested in isolation.
