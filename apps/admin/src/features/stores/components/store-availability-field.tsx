"use client";

import { Checkbox, Label, Switch } from "@loyalty/ui";
import { useTranslations } from "next-intl";

import { useStoreScope } from "@/lib/store-scope";

/**
 * "¿En qué tiendas?" control shared by the catalog wizards (products, rewards,
 * promotions, banners). `value` is the row's `storeIds`: `null` = available at
 * every store; an array = restricted to those stores. Hidden when the org has a
 * single store (nothing to choose). Reads the store list from the active scope.
 */
export function StoreAvailabilityField({
  value,
  onChange,
}: {
  value: string[] | null;
  onChange: (value: string[] | null) => void;
}) {
  const t = useTranslations("StoreAvailability");
  const { stores } = useStoreScope();

  // Nothing to scope with a single store.
  if (stores.length < 2) return null;

  const all = value == null || value.length === 0;
  const toggle = (id: string, checked: boolean) => {
    const current = value ?? [];
    onChange(checked ? [...current, id] : current.filter((s) => s !== id));
  };

  return (
    <div className="border-border bg-card space-y-3 rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="text-sm font-bold">{t("title")}</span>
          <p className="text-muted-foreground mt-0.5 text-xs">{t("hint")}</p>
        </div>
        <Switch
          checked={all}
          onCheckedChange={(on) => onChange(on ? null : stores.map((s) => s.id))}
          aria-label={t("allStores")}
        />
      </div>

      {all ? (
        <p className="text-muted-foreground text-xs font-semibold">{t("allStores")}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {stores.map((s) => (
            <Label
              key={s.id}
              className="border-border hover:bg-muted/50 flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 text-sm font-medium"
            >
              <Checkbox
                checked={(value ?? []).includes(s.id)}
                onCheckedChange={(checked) => toggle(s.id, checked === true)}
              />
              <span className="min-w-0 flex-1 truncate">{s.name || t("unnamed")}</span>
            </Label>
          ))}
        </div>
      )}
    </div>
  );
}
