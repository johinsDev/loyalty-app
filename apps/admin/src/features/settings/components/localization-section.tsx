"use client";

import {
  Button,
  Checkbox,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

const LOCALES = ["es", "en"] as const;
const CURRENCIES = ["COP", "USD"] as const;
const LOCALE_LABEL: Record<string, string> = { es: "Español", en: "English" };

/**
 * Localization settings — the org's default + enabled locales/currencies.
 * Wired to `settings.localization` / `settings.updateLocalization` (real, unlike
 * the other design-first sections). Enabling >1 surfaces the customer switchers.
 */
export function LocalizationSection() {
  const t = useTranslations("Settings");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data } = useQuery(trpc.settings.localization.queryOptions());

  const [defaultLocale, setDefaultLocale] = useState("es");
  const [enabledLocales, setEnabledLocales] = useState<string[]>(["es"]);
  const [defaultCurrency, setDefaultCurrency] = useState("COP");
  const [enabledCurrencies, setEnabledCurrencies] = useState<string[]>(["COP"]);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (data && !seeded) {
      setDefaultLocale(data.defaultLocale);
      setEnabledLocales(data.enabledLocales);
      setDefaultCurrency(data.defaultCurrency);
      setEnabledCurrencies(data.enabledCurrencies);
      setSeeded(true);
    }
  }, [data, seeded]);

  const update = useMutation(
    trpc.settings.updateLocalization.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.settings.localization.queryFilter());
        toast.success(t("saved"));
      },
      onError: () => toast.error(t("localization.error")),
    }),
  );

  // Default must stay within enabled.
  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const onSave = () => {
    if (!enabledLocales.includes(defaultLocale) || !enabledCurrencies.includes(defaultCurrency)) {
      toast.error(t("localization.defaultMustBeEnabled"));
      return;
    }
    update.mutate({
      defaultLocale: defaultLocale as "es" | "en",
      enabledLocales: enabledLocales as ("es" | "en")[],
      defaultCurrency: defaultCurrency as "COP" | "USD",
      enabledCurrencies: enabledCurrencies as ("COP" | "USD")[],
    });
  };

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {t("localization.title")}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("localization.desc")}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs">{t("localization.locales")}</Label>
          <div className="flex flex-wrap gap-3">
            {LOCALES.map((l) => (
              <label key={l} className="flex items-center gap-2 text-sm font-semibold">
                <Checkbox
                  checked={enabledLocales.includes(l)}
                  onCheckedChange={() => setEnabledLocales((cur) => toggle(cur, l))}
                />
                {LOCALE_LABEL[l]}
              </label>
            ))}
          </div>
          <Label className="text-xs">{t("localization.defaultLocale")}</Label>
          <Select value={defaultLocale} onValueChange={(v) => setDefaultLocale(v ?? "es")}>
            <SelectTrigger size="lg" className="w-full text-sm">
              <SelectValue>{(v) => LOCALE_LABEL[v as string]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((l) => (
                <SelectItem key={l} value={l}>
                  {LOCALE_LABEL[l]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">{t("localization.currencies")}</Label>
          <div className="flex flex-wrap gap-3">
            {CURRENCIES.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm font-semibold">
                <Checkbox
                  checked={enabledCurrencies.includes(c)}
                  onCheckedChange={() => setEnabledCurrencies((cur) => toggle(cur, c))}
                />
                {c}
              </label>
            ))}
          </div>
          <Label className="text-xs">{t("localization.defaultCurrency")}</Label>
          <Select value={defaultCurrency} onValueChange={(v) => setDefaultCurrency(v ?? "COP")}>
            <SelectTrigger size="lg" className="w-full text-sm">
              <SelectValue>{(v) => v as string}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button className="h-10 rounded-xl font-semibold" onClick={onSave} disabled={update.isPending}>
        {t("save")}
      </Button>
    </section>
  );
}
