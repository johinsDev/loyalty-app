"use client";

import type { StampsConfigAdminView } from "@loyalty/api/features/settings/schemas";
import {
  STAMP_CARD_COPY_KEYS,
  STAMPS_GOAL_MAX,
  STAMPS_GOAL_MIN,
} from "@loyalty/api/features/settings/schemas";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  Input,
  NumberInput,
  Skeleton,
  STAMP_CARD_TEMPLATES,
  STAMP_ICONS,
  StampCardTemplate,
  type StampCardView,
  StampIcon,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useUploadImage } from "@/features/storage/hooks/use-upload-image";
import { useTRPC } from "@/lib/trpc/client";

type Style = NonNullable<StampsConfigAdminView["style"]>;
type Copy = StampsConfigAdminView["copy"];
type CopyKey = (typeof STAMP_CARD_COPY_KEYS)[number];
type OffStyle = Style["offStyle"];

const DEFAULT_STYLE: Style = {
  icon: { kind: "lucide", value: "cup-soda" },
  onColor: null,
  offStyle: "number",
};

const OFF_STYLES: OffStyle[] = ["dim", "outline", "number"];

type PrizeOption = { id: string; label: string };
type CategoryItem = { id: string; name: string };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Interpolate the `{count}` token of a copy override for the live preview. */
const fillCount = (text: string, count: number) =>
  text.replaceAll("{count}", String(count));

const templateName = (key: string, locale: string): string => {
  const tpl = STAMP_CARD_TEMPLATES.find((x) => x.key === key);
  return tpl ? tpl.name[locale === "en" ? "en" : "es"] : key;
};

/**
 * Lealtad → stamps configuration: the card prize (a catalog reward link), the
 * earning rules (purchases per stamp, min ticket, category allowlist), the
 * stamp look (icon / on-color / off-style), the card template, and per-locale
 * copy overrides. Drives `settings.stampsConfigAdmin` / `updateStampsConfig`.
 * Only on screen while stamps earn — `LoyaltyView` hides it in points-only
 * mode (reacting to the draft mode, before saving).
 */
export function StampsSection() {
  const t = useTranslations("Settings");
  const locale = useLocale();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const uploadImage = useUploadImage();

  const { data } = useQuery(trpc.settings.stampsConfigAdmin.queryOptions());
  const categories = useQuery(trpc.menu.categories.queryOptions());
  const loc = useQuery(trpc.settings.localization.queryOptions());

  const [seeded, setSeeded] = useState(false);
  const [cardRewardId, setCardRewardId] = useState<string | null>(null);
  const [goal, setGoal] = useState(9);
  const [purchasesPerStamp, setPurchasesPerStamp] = useState(1);
  const [minAmount, setMinAmount] = useState<Record<string, number>>({});
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [template, setTemplate] = useState("classic");
  const [style, setStyle] = useState<Style>(DEFAULT_STYLE);
  const [copy, setCopy] = useState<Copy>({});
  const [copyLocale, setCopyLocale] = useState("es");
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Seed once from the server config (brand-section pattern).
  useEffect(() => {
    if (!data || seeded) return;
    setCardRewardId(data.cardRewardId);
    setGoal(data.goal);
    setPurchasesPerStamp(data.purchasesPerStamp);
    setMinAmount(data.minAmount);
    setCategoryIds(data.categoryIds);
    setTemplate(data.template);
    setStyle(data.style ?? DEFAULT_STYLE);
    setCopy(data.copy ?? {});
    setSeeded(true);
  }, [data, seeded]);

  const save = useMutation(
    trpc.settings.updateStampsConfig.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.settings.stampsConfigAdmin.queryFilter()),
          queryClient.invalidateQueries(trpc.settings.loyaltyConfig.queryFilter()),
        ]);
        toast.success(t("saved"));
      },
      onError: (err) => {
        if (err.message.startsWith("STAMPS_COPY_PLACEHOLDER")) {
          toast.error(t("loyalty.stamps.errPlaceholder"));
        } else if (err.message.startsWith("STAMPS_REWARD_INVALID")) {
          toast.error(t("loyalty.stamps.errReward"));
        } else {
          toast.error(t("loyalty.error"));
        }
      },
    }),
  );

  if (!data || !seeded) {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }

  const enabledLocales = loc.data?.enabledLocales ?? ["es"];
  const activeCopyLocale = enabledLocales.includes(copyLocale)
    ? copyLocale
    : (loc.data?.defaultLocale ?? enabledLocales[0] ?? "es");

  const setCopyValue = (key: CopyKey, value: string) =>
    setCopy((prev) => ({
      ...prev,
      [activeCopyLocale]: { ...prev[activeCopyLocale], [key]: value },
    }));

  // An emptyBody override is meaningless without its {count}; block the save.
  const emptyBodyInvalid = (lc: string) => {
    const v = copy[lc]?.emptyBody?.trim();
    return !!v && !v.includes("{count}");
  };
  const invalidCopyLocale = Object.keys(copy).find(emptyBodyInvalid) ?? null;

  const onSelectReward = (id: string | null) => {
    setCardRewardId(id);
    if (id) {
      const opt = data.rewardOptions.find((r) => r.id === id);
      if (opt?.stampsRequired != null) {
        setGoal(clamp(opt.stampsRequired, STAMPS_GOAL_MIN, STAMPS_GOAL_MAX));
      }
    }
  };

  const buildCopy = (): Copy => {
    const out: Copy = {};
    for (const [lc, entries] of Object.entries(copy)) {
      const kept: Partial<Record<CopyKey, string>> = {};
      for (const key of STAMP_CARD_COPY_KEYS) {
        const v = entries?.[key]?.trim();
        if (v) kept[key] = v;
      }
      if (Object.keys(kept).length > 0) out[lc] = kept;
    }
    return out;
  };

  const doSave = () => {
    setConfirmOpen(false);
    save.mutate({
      cardRewardId,
      goal,
      purchasesPerStamp,
      minAmount,
      categoryIds,
      template,
      style,
      copy: buildCopy(),
    });
  };
  const onSave = () => {
    if (invalidCopyLocale) {
      setCopyLocale(invalidCopyLocale);
      toast.error(t("loyalty.stamps.copies.countRequired"));
      return;
    }
    const lowering = goal < data.goal;
    const relinked = data.cardRewardId !== null && cardRewardId !== data.cardRewardId;
    if (lowering || relinked) setConfirmOpen(true);
    else doSave();
  };

  const onUploadIcon = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await uploadImage(file);
    if (url) setStyle((s) => ({ ...s, icon: { kind: "image", value: url } }));
    else toast.error(t("loyalty.error"));
  };

  // The link may be broken (reward unpublished / no longer stamps-priced): the
  // saved id is missing from `rewardOptions`, so keep it selectable by name.
  const brokenOption =
    data.brokenLink && data.linkedReward && cardRewardId === data.cardRewardId
      ? data.linkedReward
      : null;
  const selectedRewardName =
    data.rewardOptions.find((r) => r.id === cardRewardId)?.name ??
    (cardRewardId === data.cardRewardId ? (data.linkedReward?.name ?? null) : null);

  // Searchable prize picker options: unlinked first, then the (possibly broken)
  // saved link, then every published stamps-priced reward with its cost.
  const prizeOptions: PrizeOption[] = [
    { id: "", label: t("loyalty.stamps.prizeUnlinked") },
    ...(brokenOption ? [{ id: brokenOption.id, label: brokenOption.name }] : []),
    ...data.rewardOptions.map((r) => ({
      id: r.id,
      label:
        r.stampsRequired != null
          ? t("loyalty.stamps.prizeOption", { name: r.name, n: r.stampsRequired })
          : r.name,
    })),
  ];

  // Copies are advanced/optional: the disclosure starts open only when the
  // org already saved at least one override.
  const hasCopyOverrides = Object.values(data.copy ?? {}).some((entries) =>
    Object.values(entries ?? {}).some((v) => !!v?.trim()),
  );

  const categoryItems: CategoryItem[] = (categories.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const selectedCategories: CategoryItem[] = categoryIds.map(
    (id) => categoryItems.find((c) => c.id === id) ?? { id, name: id },
  );

  // Live sample fed to every preview — the editor state IS the customer render.
  const filled = clamp(Math.round(goal * 0.6), 1, goal - 1);
  const remaining = goal - filled;
  const ov = copy[activeCopyLocale] ?? {};
  const sampleView: StampCardView = {
    goal,
    filledInCycle: filled,
    totalStamps: filled,
    pending: null,
    icon: style.icon,
    onColor: style.onColor,
    offStyle: style.offStyle,
    title: ov.title?.trim() || t("loyalty.stamps.copies.ph.title"),
    subtitle: fillCount(
      ov.subtitle?.trim() || t("loyalty.stamps.copies.ph.subtitle"),
      remaining,
    ),
    countLabel: t("loyalty.stamps.sampleCount", { count: filled }),
    pendingLabel: null,
    pausedLabel: null,
    prizeName: selectedRewardName,
    spotAriaLabel: () => "",
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {t("loyalty.stamps.title")}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("loyalty.stamps.desc")}</p>
      </div>

      <div className="space-y-6">
        {/* Prize & goal */}
        <div className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <span className="text-sm font-bold">{t("loyalty.stamps.prize")}</span>
              <Combobox<PrizeOption>
                items={prizeOptions}
                value={prizeOptions.find((p) => p.id === (cardRewardId ?? "")) ?? null}
                onValueChange={(sel) => onSelectReward(sel?.id ? sel.id : null)}
                itemToStringLabel={(p) => p.label}
                isItemEqualToValue={(a, b) => a.id === b.id}
              >
                <ComboboxInput
                  placeholder={t("loyalty.stamps.prizeSearch")}
                  className="h-10 w-full rounded-xl"
                />
                <ComboboxContent>
                  <ComboboxEmpty className="py-3">
                    {t("loyalty.stamps.noResults")}
                  </ComboboxEmpty>
                  <ComboboxList className="p-1.5">
                    {prizeOptions.map((p) => (
                      <ComboboxItem key={p.id || "none"} value={p} className="rounded-lg">
                        {p.label}
                      </ComboboxItem>
                    ))}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold" htmlFor="stamps-goal">
                {t("loyalty.stamps.goal")}
              </label>
              <NumberInput
                id="stamps-goal"
                value={goal}
                onValueChange={(v) =>
                  setGoal(
                    clamp(Math.round(v ?? STAMPS_GOAL_MIN), STAMPS_GOAL_MIN, STAMPS_GOAL_MAX),
                  )
                }
                className="h-10 w-28"
                disabled={cardRewardId === null}
              />
              <p className="text-muted-foreground text-xs">{t("loyalty.stamps.goalHint")}</p>
            </div>
          </div>
          {cardRewardId === null ? (
            <p className="bg-muted/40 border-border text-muted-foreground rounded-2xl border p-3 text-sm">
              {t("loyalty.stamps.unlinkedNudge")}
            </p>
          ) : null}
          {brokenOption ? (
            <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm font-semibold text-amber-700">
              {t("loyalty.stamps.brokenLink")}
            </p>
          ) : null}
        </div>

        {/* Earning rules */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <span className="text-sm font-bold">{t("loyalty.stamps.perStamp")}</span>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t("loyalty.stamps.perStampHint")}
              </p>
            </div>
            <NumberInput
              value={purchasesPerStamp}
              onValueChange={(v) => setPurchasesPerStamp(clamp(Math.round(v ?? 1), 1, 10))}
              className="h-10 w-28"
            />
            <div>
              <span className="text-sm font-bold">{t("loyalty.stamps.minAmount")}</span>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t("loyalty.stamps.minAmountHint")}
              </p>
            </div>
            {Object.keys(minAmount).map((currency) => (
              <div
                key={currency}
                className="border-border flex flex-wrap items-center gap-2 rounded-2xl border p-3"
              >
                <NumberInput
                  value={Math.round((minAmount[currency] ?? 0) / 100)}
                  onValueChange={(v) =>
                    setMinAmount((prev) => ({
                      ...prev,
                      [currency]: Math.max(0, Math.round(v ?? 0)) * 100,
                    }))
                  }
                  className="h-10 w-32"
                />
                <Badge variant="outline">{currency}</Badge>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <div>
              <span className="text-sm font-bold">{t("loyalty.stamps.categories")}</span>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t("loyalty.stamps.categoriesHint")}
              </p>
            </div>
            <Combobox
              items={categoryItems}
              multiple
              value={selectedCategories}
              onValueChange={(v: CategoryItem[]) => setCategoryIds(v.map((c) => c.id))}
              itemToStringLabel={(c: CategoryItem) => c.name}
              isItemEqualToValue={(a: CategoryItem, b: CategoryItem) => a.id === b.id}
            >
              <ComboboxChips className="min-h-10 rounded-xl">
                {selectedCategories.map((c) => (
                  <ComboboxChip key={c.id}>{c.name}</ComboboxChip>
                ))}
                <ComboboxChipsInput
                  placeholder={
                    selectedCategories.length === 0
                      ? t("loyalty.stamps.categoriesSearch")
                      : undefined
                  }
                />
              </ComboboxChips>
              <ComboboxContent>
                <ComboboxEmpty className="py-3">
                  {t("loyalty.stamps.noResults")}
                </ComboboxEmpty>
                <ComboboxList className="p-1.5">
                  {categoryItems.map((c) => (
                    <ComboboxItem key={c.id} value={c} className="rounded-lg">
                      {c.name}
                    </ComboboxItem>
                  ))}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
        </div>

        {/* Card design — ONE live preview + every visual control beside it
            (template, icon, color, off-style). The preview and the thumbnails
            are `.preview-customer`-scoped so they render in the STORE's brand
            colors, not the admin violet. */}
        <div className="space-y-3">
          <div>
            <span className="text-sm font-bold">{t("loyalty.stamps.design")}</span>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {t("loyalty.stamps.designHint")}
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr] lg:items-start">
            <div className="preview-customer space-y-2 lg:sticky lg:top-6">
              <StampCardTemplate template={template} view={sampleView} />
              <p className="text-muted-foreground text-center text-xs font-bold">
                {templateName(template, locale)}
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <span className="text-sm font-bold">{t("loyalty.stamps.template")}</span>
                <div
                  role="radiogroup"
                  aria-label={t("loyalty.stamps.template")}
                  className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5"
                >
                  {STAMP_CARD_TEMPLATES.map((tpl) => {
                    const selected = template === tpl.key;
                    return (
                      <button
                        key={tpl.key}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setTemplate(tpl.key)}
                        className={`group rounded-2xl text-left outline-none ${
                          selected ? "" : "opacity-80 hover:opacity-100"
                        }`}
                      >
                        <div
                          className={`bg-muted/40 relative h-24 overflow-hidden rounded-2xl transition-shadow ${
                            selected
                              ? "ring-primary ring-2"
                              : "ring-border group-hover:ring-primary/40 ring-1"
                          }`}
                        >
                          <div className="preview-customer pointer-events-none absolute top-0 left-1/2 w-[320px] origin-top -translate-x-1/2 scale-50 p-2">
                            <StampCardTemplate template={tpl.key} view={sampleView} />
                          </div>
                          {selected ? (
                            <span className="bg-primary absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full text-white shadow-sm">
                              <Check className="size-3.5" strokeWidth={3} />
                            </span>
                          ) : null}
                        </div>
                        <div
                          className={`mt-1 truncate text-center text-xs font-bold ${
                            selected ? "" : "text-muted-foreground"
                          }`}
                        >
                          {tpl.name[locale === "en" ? "en" : "es"]}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-bold">{t("loyalty.stamps.icon")}</span>
                <div className="flex flex-wrap gap-2">
                  {STAMP_ICONS.map(({ key, Icon }) => {
                    const selected =
                      style.icon.kind === "lucide" && style.icon.value === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-label={key}
                        aria-pressed={selected}
                        onClick={() =>
                          setStyle((s) => ({ ...s, icon: { kind: "lucide", value: key } }))
                        }
                        className={`grid size-10 place-items-center rounded-xl border transition-colors ${
                          selected
                            ? "border-primary bg-primary/5 ring-primary/30 ring-2"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <Icon className="size-5" />
                      </button>
                    );
                  })}
                  <label
                    title={t("loyalty.stamps.iconUpload")}
                    className={`grid size-10 cursor-pointer place-items-center rounded-xl border transition-colors ${
                      style.icon.kind === "image"
                        ? "border-primary bg-primary/5 ring-primary/30 ring-2"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    {style.icon.kind === "image" ? (
                      <StampIcon icon={style.icon} className="size-5" />
                    ) : (
                      <Upload className="text-muted-foreground size-5" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={onUploadIcon}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-bold">{t("loyalty.stamps.onColor")}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStyle((s) => ({ ...s, onColor: null }))}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
                      style.onColor === null
                        ? "border-primary bg-primary/5 ring-primary/30 ring-2"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span className="preview-customer bg-primary size-5 rounded-full border border-black/10" />
                    <span className="text-sm font-semibold">
                      {t("loyalty.stamps.brandColor")}
                    </span>
                  </button>
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
                      style.onColor !== null
                        ? "border-primary bg-primary/5 ring-primary/30 ring-2"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <input
                      type="color"
                      value={style.onColor ?? "#f0a868"}
                      onChange={(e) =>
                        setStyle((s) => ({ ...s, onColor: e.target.value }))
                      }
                      className="size-5 cursor-pointer rounded-full border-none bg-transparent p-0"
                    />
                    <span className="text-sm font-semibold">
                      {t("loyalty.stamps.customColor")}
                    </span>
                  </label>
                  {style.onColor !== null ? (
                    <button
                      type="button"
                      onClick={() => setStyle((s) => ({ ...s, onColor: null }))}
                      className="text-primary text-xs font-bold"
                    >
                      {t("loyalty.stamps.resetColor")}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-bold">{t("loyalty.stamps.offStyle")}</span>
                <div
                  role="radiogroup"
                  aria-label={t("loyalty.stamps.offStyle")}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-3"
                >
                  {OFF_STYLES.map((key) => {
                    const selected = style.offStyle === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setStyle((s) => ({ ...s, offStyle: key }))}
                        className={`rounded-2xl border p-3 text-left transition-colors ${
                          selected
                            ? "border-primary bg-primary/5 ring-primary/30 ring-2"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <div className="text-sm font-bold">
                          {t(`loyalty.stamps.offStyleOpt.${key}`)}
                        </div>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {t(`loyalty.stamps.offStyleDesc.${key}`)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Copies editor — advanced/optional, so it lives behind a disclosure;
            open by default only when the org already saved overrides. */}
        <Accordion
          defaultValue={hasCopyOverrides ? ["copies"] : []}
          className="border-border rounded-2xl border"
        >
          <AccordionItem value="copies" className="border-none">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="text-left">
                <span className="text-sm font-bold">
                  {t("loyalty.stamps.copies.title")}
                </span>
                <p className="text-muted-foreground mt-0.5 text-xs font-normal">
                  {t("loyalty.stamps.copies.hint")}
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 px-4 pb-4">
              {enabledLocales.length > 1 ? (
                <Tabs value={activeCopyLocale} onValueChange={setCopyLocale}>
                  <TabsList className="h-9" aria-label={t("loyalty.stamps.copies.tabLabel")}>
                    {enabledLocales.map((l) => (
                      <TabsTrigger key={l} value={l} className="px-3 uppercase">
                        {l}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
            {STAMP_CARD_COPY_KEYS.map((key) => (
              <div key={key} className="space-y-1">
                <label className="text-sm font-bold" htmlFor={`stamps-copy-${key}`}>
                  {t(`loyalty.stamps.copies.label.${key}`)}
                </label>
                <Input
                  id={`stamps-copy-${key}`}
                  value={copy[activeCopyLocale]?.[key] ?? ""}
                  onChange={(e) => setCopyValue(key, e.target.value)}
                  placeholder={t(`loyalty.stamps.copies.ph.${key}`)}
                  className="h-10"
                />
                {key === "subtitle" ? (
                  <p className="text-muted-foreground text-xs">
                    {t("loyalty.stamps.copies.countHint")}
                  </p>
                ) : null}
                {key === "emptyBody" ? (
                  <p
                    className={
                      emptyBodyInvalid(activeCopyLocale)
                        ? "text-destructive text-xs font-semibold"
                        : "text-muted-foreground text-xs"
                    }
                  >
                    {t("loyalty.stamps.copies.countRequired")}
                  </p>
                ) : null}
              </div>
            ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Button
          onClick={onSave}
          disabled={save.isPending}
          className="h-10 rounded-xl px-6 font-semibold"
        >
          {t("save")}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("loyalty.stamps.confirmLowerTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("loyalty.stamps.confirmLowerBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10 px-4">
              {t("loyalty.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={doSave} className="h-10 px-4">
              {t("loyalty.stamps.confirmLowerAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
