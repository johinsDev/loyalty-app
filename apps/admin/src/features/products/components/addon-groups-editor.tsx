"use client";

import { Button, Checkbox, Input } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { Check, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

import type { AddonGroupDraft } from "../data";

const fmtCop = (cents: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(cents) / 100);

const freshId = () => `ag_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Attach reusable catalog add-ons to a product as groups (single/multi,
 * optionally required). Each group offers a chosen subset of the catalog; the
 * price comes from the catalog, not per product.
 */
export function AddonGroupsEditor({
  groups,
  onChange,
}: {
  groups: AddonGroupDraft[];
  onChange: (next: AddonGroupDraft[]) => void;
}) {
  const t = useTranslations("Products");
  const trpc = useTRPC();
  const catalog = useQuery(trpc.menu.addons.queryOptions({}));
  const addons = (catalog.data ?? []).filter((a) => a.active);

  const setGroup = (idx: number, next: AddonGroupDraft) =>
    onChange(groups.map((g, i) => (i === idx ? next : g)));

  const addGroup = () =>
    onChange([
      ...groups,
      {
        id: freshId(),
        name: "",
        selectionType: "multi",
        required: false,
        sortOrder: groups.length,
        addonIds: [],
      },
    ]);

  const toggleAddon = (idx: number, addonId: string) => {
    const g = groups[idx]!;
    const has = g.addonIds.includes(addonId);
    setGroup(idx, {
      ...g,
      addonIds: has ? g.addonIds.filter((id) => id !== addonId) : [...g.addonIds, addonId],
    });
  };

  if (addons.length === 0) {
    return (
      <p className="text-muted-foreground text-sm font-semibold">
        {t("addonGroups.emptyCatalog")}{" "}
        <Link href="/products/add-ons" className="text-primary underline">
          {t("addon.title")}
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((g, idx) => (
        <div key={g.id} className="border-border rounded-2xl border p-3.5">
          <div className="flex items-center gap-2">
            <Input
              value={g.name}
              onChange={(e) => setGroup(idx, { ...g, name: e.target.value })}
              placeholder={t("addonGroups.namePlaceholder")}
              className="h-10 flex-1"
            />
            <div className="bg-muted flex rounded-lg p-0.5">
              {(["single", "multi"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setGroup(idx, { ...g, selectionType: st })}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-bold ${g.selectionType === st ? "bg-card shadow-sm" : "text-muted-foreground"}`}
                >
                  {t(`addonGroups.${st}`)}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
              <Checkbox
                checked={g.required}
                onCheckedChange={(ch) => setGroup(idx, { ...g, required: ch === true })}
              />
              {t("addonGroups.required")}
            </label>
            <button
              type="button"
              aria-label={t("delete")}
              onClick={() => onChange(groups.filter((_, i) => i !== idx))}
              className="text-muted-foreground hover:text-destructive grid size-8 place-items-center rounded-lg"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {addons.map((a) => {
              const on = g.addonIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAddon(idx, a.id)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold ${on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
                >
                  {on ? <Check className="size-3" /> : null}
                  {a.name}
                  <span className={on ? "opacity-80" : "text-muted-foreground/60"}>
                    +{fmtCop(a.priceDeltaCents)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={addGroup} className="h-9 gap-1.5 rounded-lg">
        <Plus className="size-3.5" />
        {t("addonGroups.addGroup")}
      </Button>
    </div>
  );
}
