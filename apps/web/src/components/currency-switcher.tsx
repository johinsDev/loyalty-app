"use client";

import { SegmentedControl } from "@loyalty/ui";
import { useTranslations } from "next-intl";

import { useCurrency } from "@/lib/currency";

/** Customer currency switcher — only meaningful when the org enables >1.
 *  Setting writes the cookie + reloads so prices re-resolve. */
export function CurrencySwitcher() {
  const t = useTranslations("Common");
  const { currency, enabledCurrencies, setCurrency } = useCurrency();

  return (
    <SegmentedControl<string>
      aria-label={t("switchCurrency")}
      value={currency}
      onValueChange={setCurrency}
      options={enabledCurrencies.map((c) => ({ value: c, label: c }))}
    />
  );
}
