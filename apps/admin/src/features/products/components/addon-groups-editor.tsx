"use client";

import { Badge, Button, Checkbox, Input, NumberInput } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Link } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

import type { AddonGroupDraft, AddonGroupMode, AddonGroupSource } from "../data";

const freshId = () => `ag_${Math.random().toString(36).slice(2, 8)}`;

const MODES: AddonGroupMode[] = ["exactlyOne", "upTo", "any"];

const fmtCop = (cents: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(cents) / 100);

/**
 * Add-on groups on a product.
 *
 * Replaces a UI that (a) offered a bare "Una / Varias" toggle which never said
 * how many the customer could actually pick, and (b) dumped the entire active
 * catalog into one flat row of chips with no search — unusable past a handful
 * of add-ons. Now a group either points at a category (and stays in sync with
 * it) or picks specific add-ons from a searchable list, and the selection rule
 * is stated in plain language with a live preview of the resulting sentence.
 */
export function AddonGroupsEditor({
  groups,
  onChange,
}: {
  groups: AddonGroupDraft[];
  onChange: (next: AddonGroupDraft[]) => void;
}) {
  const t = useTranslations("Products.addonGroups");
  const trpc = useTRPC();

  const catalog = useQuery(trpc.addons.picker.queryOptions({}));
  const categoriesQuery = useQuery(
    trpc.catalogCategories.list.queryOptions({ kind: "addon" }),
  );
  const addons = catalog.data ?? [];
  const categories = categoriesQuery.data ?? [];

  const set = (idx: number, next: AddonGroupDraft) =>
    onChange(groups.map((g, i) => (i === idx ? next : g)));

  const add = () =>
    onChange([
      ...groups,
      {
        id: freshId(),
        name: "",
        source: "manual",
        categoryId: null,
        mode: "any",
        maxSelect: 3,
        required: false,
        sortOrder: groups.length,
        addonIds: [],
      },
    ]);

  if (addons.length === 0 && categories.length === 0) {
    return (
      <div className="text-muted-foreground text-sm font-semibold">
        {t("emptyCatalog")}{" "}
        <Link href="/products/add-ons" className="text-primary underline">
          {t("goToCatalog")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((g, idx) => (
        <GroupCard
          key={g.id}
          group={g}
          addons={addons}
          categories={categories}
          onChange={(next) => set(idx, next)}
          onRemove={() => onChange(groups.filter((_, i) => i !== idx))}
        />
      ))}
      <Button variant="outline" onClick={add} className="rounded-xl">
        <Plus className="mr-2 size-4" />
        {t("addGroup")}
      </Button>
    </div>
  );
}

type Addon = { id: string; name: string; priceDeltaCents: number };
type Category = { id: string; name: string; memberCount: number };

function GroupCard({
  group,
  addons,
  categories,
  onChange,
  onRemove,
}: {
  group: AddonGroupDraft;
  addons: Addon[];
  categories: Category[];
  onChange: (next: AddonGroupDraft) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("Products.addonGroups");
  const [search, setSearch] = useState("");

  const setSource = (source: AddonGroupSource) => onChange({ ...group, source });

  const category = categories.find((c) => c.id === group.categoryId) ?? null;
  const resolvedCount =
    group.source === "category" ? (category?.memberCount ?? 0) : group.addonIds.length;

  const filtered = addons.filter((a) =>
    a.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const toggleAddon = (id: string) =>
    onChange({
      ...group,
      addonIds: group.addonIds.includes(id)
        ? group.addonIds.filter((x) => x !== id)
        : [...group.addonIds, id],
    });

  // The sentence the customer effectively gets — the whole point is that the
  // person configuring this can read it back before saving.
  const preview = t(`preview.${group.mode}`, {
    name: group.name.trim() || t("defaultName"),
    n: group.maxSelect,
    required:
      group.mode === "exactlyOne" || group.required
        ? t("previewRequired")
        : t("previewOptional"),
  });

  return (
    <div className="border-border rounded-2xl border p-3.5">
      <div className="flex items-center gap-2">
        <Input
          value={group.name}
          onChange={(e) => onChange({ ...group, name: e.target.value })}
          placeholder={t("namePlaceholder")}
          className="h-10"
        />
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive size-9 flex-none"
          aria-label={t("removeGroup")}
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="mt-3">
        <p className="text-xs font-bold">{t("source.label")}</p>
        <div className="mt-1.5 space-y-1.5">
          {(["category", "manual"] as const).map((s) => (
            <label key={s} className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="radio"
                name={`source-${group.id}`}
                checked={group.source === s}
                onChange={() => setSource(s)}
                className="mt-1"
              />
              <span>
                <span className="font-semibold">{t(`source.${s}`)}</span>
                <span className="text-muted-foreground/70 block text-xs font-semibold">
                  {t(`source.${s}Hint`)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {group.source === "category" ? (
        <div className="mt-3">
          {categories.length === 0 ? (
            <p className="text-muted-foreground text-xs font-semibold">
              {t("source.noCategories")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onChange({ ...group, categoryId: c.id })}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                    group.categoryId === c.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {c.name}
                  <span className="ml-1 text-xs opacity-70">({c.memberCount})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchAddons")}
              className="h-9 pl-8"
            />
          </div>
          <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="text-muted-foreground py-3 text-center text-xs font-semibold">
                {t("noneFound")}
              </p>
            ) : (
              filtered.map((a) => (
                <label
                  key={a.id}
                  className="hover:bg-muted/50 flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm"
                >
                  <Checkbox
                    checked={group.addonIds.includes(a.id)}
                    onCheckedChange={() => toggleAddon(a.id)}
                  />
                  <span className="flex-1 font-semibold">{a.name}</span>
                  <span className="text-muted-foreground text-xs font-semibold tabular-nums">
                    +{fmtCop(a.priceDeltaCents)}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}

      <div className="mt-3">
        <p className="text-xs font-bold">{t("rule.label")}</p>
        <div className="mt-1.5 space-y-1.5">
          {MODES.map((m) => (
            <label key={m} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="radio"
                name={`mode-${group.id}`}
                checked={group.mode === m}
                onChange={() => onChange({ ...group, mode: m })}
              />
              <span className="font-semibold">{t(`rule.${m}`)}</span>
              {m === "upTo" && group.mode === "upTo" ? (
                <NumberInput
                  value={group.maxSelect}
                  onValueChange={(v) => onChange({ ...group, maxSelect: Math.max(1, v ?? 1) })}
                  min={1}
                  className="h-8 w-20"
                />
              ) : null}
            </label>
          ))}
          {group.mode !== "exactlyOne" ? (
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox
                checked={group.required}
                onCheckedChange={(c) => onChange({ ...group, required: c === true })}
              />
              <span className="font-semibold">{t("rule.required")}</span>
            </label>
          ) : null}
        </div>
      </div>

      <div className="bg-muted/40 mt-3 rounded-xl px-3 py-2">
        <p className="text-muted-foreground text-xs font-semibold">{t("previewLabel")}</p>
        <p className="mt-0.5 text-sm font-semibold">{preview}</p>
        <Badge variant="secondary" className="mt-1.5">
          {t("resolves", { n: resolvedCount })}
        </Badge>
      </div>
    </div>
  );
}
