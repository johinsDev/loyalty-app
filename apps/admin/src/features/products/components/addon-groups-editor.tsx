"use client";

import {
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  NumberInput,
  RadioGroup,
  RadioGroupItem,
} from "@loyalty/ui";
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

type Addon = {
  id: string;
  name: string;
  priceDeltaCents: number;
  categoryId: string | null;
};
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

  // What the register will actually offer. `memberCount` counts every add-on in
  // the category including inactive ones; the picker only returns active, so
  // resolving locally is both cheaper (no extra request) and more truthful.
  const resolved =
    group.source === "category"
      ? group.categoryId
        ? addons.filter((a) => a.categoryId === group.categoryId)
        : []
      : addons.filter((a) => group.addonIds.includes(a.id));
  const resolvedCount = resolved.length;

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
    <div className="border-border space-y-5 rounded-2xl border p-4">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Input
            value={group.name}
            onChange={(e) => onChange({ ...group, name: e.target.value })}
            placeholder={t("namePlaceholder")}
            aria-invalid={!group.name.trim()}
            aria-label={t("nameLabel")}
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
        {/* Required: an unnamed group has no header at the register, and it is
            what the preview sentence is built from. */}
        {!group.name.trim() ? (
          <p className="text-destructive text-xs font-semibold">{t("nameRequired")}</p>
        ) : null}
      </div>

      <div className="space-y-2.5">
        <Label className="text-xs">{t("source.label")}</Label>
        {/* The panel for each source renders directly under ITS OWN option, so
            there is never a doubt about which choice it belongs to. */}
        <RadioGroup
          value={group.source}
          onValueChange={(v) => setSource(v as AddonGroupSource)}
          className="gap-3"
        >
          {(["category", "manual"] as const).map((s) => (
            <div key={s} className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3">
                <RadioGroupItem value={s} className="mt-0.5 flex-none" />
                <span className="space-y-0.5">
                  <span className="block text-sm font-semibold leading-none">
                    {t(`source.${s}`)}
                  </span>
                  <span className="text-muted-foreground/70 block text-xs font-semibold">
                    {t(`source.${s}Hint`)}
                  </span>
                </span>
              </label>

              {group.source !== s ? null : s === "category" ? (
                categories.length === 0 ? (
                  <p className="text-muted-foreground ml-7 text-xs font-semibold">
                    {t("source.noCategories")}
                  </p>
                ) : (
                  <div className="ml-7 flex flex-wrap gap-2">
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onChange({ ...group, categoryId: c.id })}
                        aria-pressed={group.categoryId === c.id}
                        className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                          group.categoryId === c.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        {c.name}
                        <span className="ml-1.5 text-xs opacity-70">
                          {addons.filter((a) => a.categoryId === c.id).length}
                        </span>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <div className="ml-7 space-y-2">
                  <div className="relative">
                    <Search className="text-muted-foreground absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t("searchAddons")}
                      className="h-9 pl-8"
                    />
                  </div>
                  <div className="border-border max-h-48 space-y-0.5 overflow-y-auto rounded-xl border p-1.5">
                    {filtered.length === 0 ? (
                      <p className="text-muted-foreground py-4 text-center text-xs font-semibold">
                        {t("noneFound")}
                      </p>
                    ) : (
                      filtered.map((a) => (
                        <label
                          key={a.id}
                          className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm"
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
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2.5">
        <Label className="text-xs">{t("rule.label")}</Label>
        <RadioGroup
          value={group.mode}
          onValueChange={(v) => onChange({ ...group, mode: v as AddonGroupMode })}
          className="gap-3"
        >
          {MODES.map((m) => (
            <label key={m} className="flex h-8 cursor-pointer items-center gap-3">
              <RadioGroupItem value={m} className="flex-none" />
              <span className="text-sm font-semibold">{t(`rule.${m}`)}</span>
              {/* Always mounted, disabled off-mode: rendering it only when
                  `upTo` is picked changed the row height and shifted the whole
                  block below it. */}
              {m === "upTo" ? (
                <NumberInput
                  value={group.maxSelect}
                  onValueChange={(v) => onChange({ ...group, maxSelect: Math.max(1, v ?? 1) })}
                  min={1}
                  disabled={group.mode !== "upTo"}
                  aria-label={t("rule.upTo")}
                  className="h-8 w-20 disabled:opacity-40"
                />
              ) : null}
            </label>
          ))}
        </RadioGroup>
        {/* Always rendered: hiding it for `exactlyOne` shifted the whole block.
            And "exactly 1" IS required by definition, so showing it checked and
            locked explains why it can't be toggled instead of just vanishing. */}
        <label
          className={`border-border/70 mt-1 flex items-center gap-3 border-t pt-3 ${
            group.mode === "exactlyOne" ? "cursor-default" : "cursor-pointer"
          }`}
        >
          <Checkbox
            checked={group.mode === "exactlyOne" ? true : group.required}
            disabled={group.mode === "exactlyOne"}
            onCheckedChange={(c) => onChange({ ...group, required: c === true })}
          />
          <span
            className={`text-sm font-semibold ${
              group.mode === "exactlyOne" ? "text-muted-foreground" : ""
            }`}
          >
            {t("rule.required")}
          </span>
          {group.mode === "exactlyOne" ? (
            <span className="text-muted-foreground/70 text-xs font-semibold">
              {t("rule.impliedRequired")}
            </span>
          ) : null}
        </label>
      </div>

      <div className="bg-muted/40 space-y-2 rounded-xl px-3.5 py-3">
        <p className="text-muted-foreground text-xs font-semibold">{t("previewLabel")}</p>
        <p className="text-sm font-semibold">{preview}</p>
        <Badge variant="secondary">{t("resolves", { n: resolvedCount })}</Badge>
        {resolved.length > 0 ? (
          <ul className="space-y-0.5 pt-0.5">
            {resolved.map((a) => (
              <li
                key={a.id}
                className="text-muted-foreground flex justify-between gap-3 text-xs font-semibold"
              >
                <span className="truncate">{a.name}</span>
                <span className="flex-none tabular-nums">+{fmtCop(a.priceDeltaCents)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
