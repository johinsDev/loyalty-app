"use client";

import {
  Badge,
  Button,
  Checkbox,
  CurrencyInput,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  NumberInput,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
  RichTextEditor,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type Tag,
  TagInput,
  Textarea,
} from "@loyalty/ui";
import {
  Box,
  FolderTree,
  ImagePlus,
  Laptop,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useSearchParams } from "next/navigation";

import { WizardShell } from "@/components/wizard-shell";
import { StoreAvailabilityField } from "@/features/stores/components/store-availability-field";
import { useUploadImage } from "@/features/storage/hooks/use-upload-image";
import { useRouter } from "@/i18n/nav";
import { useStoreScope } from "@/lib/store-scope";
import { useTRPC } from "@/lib/trpc/client";

import {
  AGE_RANGES,
  buildVariants,
  CURRENCIES,
  emptyProductDraft,
  FEATURED_SECTIONS,
  GENDERS,
  optionLibrary,
  type OptionPreset,
  PRODUCT_EMOJIS,
  type ProductDraft,
  type ProductOption,
  type ProductStatus,
  type ProductType,
  type StockMode,
} from "../data";
import { CategoriesManager } from "./categories-view";
import { detailToDraft, draftToUpsert, type ProductPassthrough } from "./map";
import { AddonGroupsEditor } from "./addon-groups-editor";
import { RecipeEditor } from "./recipe-editor";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const STEPS = [
  "general",
  "pricing",
  "variants",
  "inventory",
  "organization",
  "review",
] as const;
type Step = (typeof STEPS)[number];

/**
 * Product editor — a Shopify/Tiendanube-style catalog product as a stepper
 * (general → pricing → variants → inventory → organization → review) with a live
 * product preview. Options are reusable: pick an existing one (auto-fills its
 * values, deselect what you don't want) or create a custom one — new options and
 * values stay available for the next product. Design-first / hardcoded.
 */
export function ProductEditor({ id }: { id?: string }) {
  const t = useTranslations("Products");
  const locale = useLocale();
  const router = useRouter();
  const trpc = useTRPC();
  const searchParams = useSearchParams();
  const { storeId: scopeStoreId } = useStoreScope();
  const [draft, setDraft] = useState<ProductDraft>(emptyProductDraft);
  const [status, setStatus] = useState<ProductStatus>("active");
  const [passthrough, setPassthrough] = useState<ProductPassthrough>({
    modifierGroups: [],
    images: [],
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [library, setLibrary] = useState<OptionPreset[]>(optionLibrary);
  const fileRef = useRef<HTMLInputElement>(null);
  // Minor-unit-less currencies (COP, …) show no decimals; USD/EUR show 2.
  const priceDecimals = ["COP", "CLP", "JPY", "KRW", "VND", "PYG"].includes(draft.currency)
    ? 0
    : 2;
  const fmtPrice = (units: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: draft.currency,
      minimumFractionDigits: priceDecimals,
      maximumFractionDigits: priceDecimals,
    }).format(units);
  const [mediaDrag, setMediaDrag] = useState<number | null>(null);
  const [mediaOver, setMediaOver] = useState<number | null>(null);
  const uploadImage = useUploadImage();
  const [uploading, setUploading] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [sectionQuery, setSectionQuery] = useState("");
  const [newSection, setNewSection] = useState("");
  const [sections, setSections] = useState(() =>
    FEATURED_SECTIONS.map((s) => ({ id: s as string, label: t(`section.${s}`) })),
  );

  // New product → create a draft row, then continue in edit mode at its URL so
  // image uploads + saves have a real product id to attach to.
  const createDraft = useMutation(trpc.menu.createDraft.mutationOptions());
  useEffect(() => {
    if (id) return;
    let cancelled = false;
    void createDraft.mutateAsync().then((newId) => {
      if (!cancelled)
        router.replace({
          pathname: "/products/[id]",
          params: { id: newId },
          query: { new: "1" },
        });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Edit → load the real product tree into the draft (+ preserve modifiers/images).
  // Load ONCE: a background refetch (e.g. window focus) must never clobber the
  // cashier's in-progress edits (added variants, price changes, …).
  const detailQuery = useQuery(
    trpc.menu.getAdmin.queryOptions(
      { id: id ?? "" },
      { enabled: Boolean(id), refetchOnWindowFocus: false },
    ),
  );
  // Hydrate the draft once per product id — a refetch must not overwrite edits,
  // but navigating to a different product (id change) should reload.
  const loadedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!detailQuery.data || loadedIdRef.current === id) return;
    loadedIdRef.current = id ?? null;
    const mapped = detailToDraft(detailQuery.data);
    // Freshly created product (redirected from /new): default the store scope to
    // the active store when the admin is scoped to one; otherwise leave null (all).
    if (searchParams.get("new") === "1" && scopeStoreId) {
      mapped.draft.storeIds = [scopeStoreId];
    }
    setDraft(mapped.draft);
    setStatus(mapped.status);
    setPassthrough(mapped.passthrough);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailQuery.data, id]);

  // Real categories for the picker (replaces the design-time mock list).
  const categoriesQuery = useQuery(trpc.menu.categories.queryOptions());
  const realCategories = (categoriesQuery.data ?? []).map((c) => ({
    id: c.id,
    label: c.name,
  }));

  const upsert = useMutation(trpc.menu.upsert.mutationOptions());

  const step = STEPS[stepIndex]!;
  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setOptions = (options: ProductOption[]) =>
    setDraft((d) => ({
      ...d,
      options,
      variants: buildVariants(options, d.variants, d.price ?? 0),
    }));

  // Upload real image files to R2 (presign → PUT → URL) and append them as
  // product photos. Non-image files are ignored.
  const uploadFiles = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    setUploading(true);
    try {
      const urls = (await Promise.all(images.map((f) => uploadImage(f)))).filter(
        (u): u is string => Boolean(u),
      );
      if (urls.length < images.length) toast.error(t("mediaUploadError"));
      if (urls.length > 0) {
        setDraft((d) => ({
          ...d,
          media: [
            ...d.media,
            ...urls.map((url) => ({ id: crypto.randomUUID(), emoji: "", url })),
          ],
        }));
      }
    } finally {
      setUploading(false);
    }
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    void uploadFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  };

  // ── Variant image picker (modal): pick from the product's images, upload a
  //    custom one, or clear it. `image` references a media id. ────────────────
  const [variantImgIdx, setVariantImgIdx] = useState<number | null>(null);
  const setVariantImage = (idx: number, mediaId: string | null) =>
    setDraft((d) => ({
      ...d,
      variants: d.variants.map((v, n) => (n === idx ? { ...v, image: mediaId } : v)),
    }));
  const uploadVariantImage = async (idx: number, file: File) => {
    setUploading(true);
    try {
      const url = await uploadImage(file);
      if (!url) {
        toast.error(t("mediaUploadError"));
        return;
      }
      const mid = crypto.randomUUID();
      setDraft((d) => ({
        ...d,
        media: [...d.media, { id: mid, emoji: "", url }],
        variants: d.variants.map((v, n) => (n === idx ? { ...v, image: mid } : v)),
      }));
    } finally {
      setUploading(false);
    }
  };

  // ── Reusable options ──────────────────────────────────────────────────────
  const addFromPreset = (preset: OptionPreset) =>
    setOptions([
      ...draft.options,
      {
        id: `o_${preset.id}_${draft.options.length}`,
        name: preset.name,
        values: [...preset.values],
      },
    ]);

  const addCustomOption = () =>
    setOptions([
      ...draft.options,
      { id: `o_custom_${Date.now()}`, name: "", values: [] },
    ]);

  const updateOption = (idx: number, next: ProductOption) => {
    const options = [...draft.options];
    options[idx] = next;
    setOptions(options);
  };

  // Keep the library in sync so values stay reusable next time (best-effort).
  const syncLibrary = (name: string, values: string[]) => {
    const optName = name.trim();
    if (!optName) return;
    setLibrary((lib) => {
      const i = lib.findIndex((l) => l.name.toLowerCase() === optName.toLowerCase());
      if (i === -1)
        return [...lib, { id: `lib_${slugify(optName)}`, name: optName, values: [...values] }];
      const merged = [...new Set([...lib[i]!.values, ...values])];
      if (merged.length === lib[i]!.values.length) return lib;
      const copy = [...lib];
      copy[i] = { ...copy[i]!, values: merged };
      return copy;
    });
  };

  const availablePresets = library.filter(
    (l) =>
      !draft.options.some(
        (o) => o.name.trim().toLowerCase() === l.name.toLowerCase(),
      ),
  );

  // Persist the whole draft. Each "Siguiente" saves, so progress is never lost
  // between steps (and a background refetch can't clobber it).
  const saveDraft = async (): Promise<boolean> => {
    if (!id) return false;
    try {
      await upsert.mutateAsync(draftToUpsert(id, draft, status, passthrough));
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveError"));
      return false;
    }
  };

  const onNext = async () => {
    const ok = await saveDraft();
    if (!ok) return; // stay on the step so the user can fix (e.g. missing name)
    if (stepIndex === STEPS.length - 1) {
      toast.success(t("updated", { name: draft.name }));
      router.push("/products");
      return;
    }
    setStepIndex((n) => n + 1);
  };

  const margin =
    draft.price && draft.cost && draft.price > 0
      ? `${Math.round(((draft.price - draft.cost) / draft.price) * 100)}%`
      : "—";

  const steps = STEPS.map((key) => ({ key, label: t(`step.${key}`) }));

  return (
    <WizardShell
      title={id ? t("editTitle") : t("newTitle")}
      steps={steps}
      current={step}
      completed={STEPS.slice(0, stepIndex)}
      onStepSelect={(key) => {
        const i = STEPS.indexOf(key as Step);
        if (i <= stepIndex) setStepIndex(i);
      }}
      onBack={() => setStepIndex((n) => Math.max(0, n - 1))}
      onNext={onNext}
      isFirst={stepIndex === 0}
      isLast={stepIndex === STEPS.length - 1}
      finishLabel={id ? t("saveChanges") : t("save")}
      preview={<ProductPreview draft={draft} locale={locale} t={t} />}
    >
      {step === "general" ? (
        <div className="space-y-6">
          <Block title={t("secName")} ai>
            <Field label={t("fieldName")}>
              <Input
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder={t("fieldNamePlaceholder")}
                className="h-10"
                autoFocus
              />
            </Field>
            <Field label={t("fieldDescription")}>
              <RichTextEditor
                value={draft.description}
                onValueChange={(html) => set("description", html)}
              />
            </Field>
          </Block>

          <Block title={t("secMedia")} divided>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {draft.media.map((m, idx) => (
                <div
                  key={m.id}
                  draggable
                  onDragStart={() => setMediaDrag(idx)}
                  onDragEnd={() => {
                    setMediaDrag(null);
                    setMediaOver(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (mediaOver !== idx) setMediaOver(idx);
                  }}
                  onDrop={() => {
                    if (mediaDrag !== null && mediaDrag !== idx) {
                      const next = [...draft.media];
                      const [item] = next.splice(mediaDrag, 1);
                      if (item) next.splice(idx, 0, item);
                      set("media", next);
                    }
                    setMediaDrag(null);
                    setMediaOver(null);
                  }}
                  className={`group relative grid aspect-square cursor-grab place-items-center overflow-hidden rounded-2xl text-3xl ring-inset transition-all active:cursor-grabbing ${
                    mediaDrag === idx
                      ? "opacity-40"
                      : mediaOver === idx && mediaDrag !== null
                        ? "bg-primary/10 ring-primary ring-2"
                        : idx === 0
                          ? "bg-muted/50 ring-primary/50 ring-2"
                          : "bg-muted/50 ring-border ring-1"
                  }`}
                >
                  {m.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt="" className="size-full object-cover" />
                  ) : (
                    m.emoji
                  )}
                  {idx === 0 ? (
                    <span className="bg-primary text-primary-foreground absolute top-1 left-1 rounded-full px-1.5 py-0.5 text-[0.625rem] font-bold shadow-sm">
                      {t("mainImage")}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-label={t("delete")}
                    onClick={() =>
                      set("media", draft.media.filter((x) => x.id !== m.id))
                    }
                    className="bg-card text-destructive absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border opacity-0 group-hover:opacity-100"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDropActive(true);
              }}
              onDragLeave={() => setDropActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDropActive(false);
                void uploadFiles(Array.from(e.dataTransfer.files));
              }}
              className={`grid w-full place-items-center rounded-2xl border border-dashed py-6 text-center transition-colors ${
                dropActive
                  ? "border-primary bg-primary/10"
                  : "border-border bg-primary/5 hover:bg-primary/10"
              }`}
            >
              <ImagePlus className="text-primary size-6" />
              <span className="text-primary mt-1 text-sm font-bold">
                {uploading ? t("mediaUploading") : t("mediaHint")}
              </span>
              <span className="text-muted-foreground/70 mt-0.5 text-xs">
                {t("mediaFormats")}
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={onPickFiles}
            />
            <div className="flex flex-wrap gap-1.5">
              {PRODUCT_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() =>
                    set("media", [
                      ...draft.media,
                      { id: `m_${e}_${draft.media.length}`, emoji: e },
                    ])
                  }
                  className="bg-muted/50 hover:bg-muted grid size-9 place-items-center rounded-lg text-lg"
                >
                  {e}
                </button>
              ))}
            </div>
            <Field label={t("videoLabel")} hint={t("videoHint")}>
              <Input
                value={draft.videoUrl}
                onChange={(e) => set("videoUrl", e.target.value)}
                placeholder={t("videoPlaceholder")}
                className="h-10"
              />
            </Field>
          </Block>
        </div>
      ) : step === "pricing" ? (
        <Block title={t("secPrices")}>
          <Field label={t("currency")}>
            <Select
              value={draft.currency}
              onValueChange={(v) => set("currency", v ?? "USD")}
            >
              <SelectTrigger size="lg" className="w-40 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("fieldPrice")}>
              <CurrencyInput
                value={draft.price ?? undefined}
                onValueChange={(v) => set("price", v ?? null)}
                currency={draft.currency}
                          decimalScale={priceDecimals}
                placeholder="0.00"
                className="h-10"
              />
            </Field>
            <Field label={t("fieldPromoPrice")} hint={t("optional")}>
              <CurrencyInput
                value={draft.promoPrice ?? undefined}
                onValueChange={(v) => set("promoPrice", v ?? null)}
                currency={draft.currency}
                          decimalScale={priceDecimals}
                placeholder="0.00"
                className="h-10"
              />
            </Field>
          </div>
          <label className="flex items-center gap-2.5 text-sm font-medium">
            <Checkbox
              checked={draft.showPrice}
              onCheckedChange={(c) => set("showPrice", c === true)}
            />
            {t("showPrice")}
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("fieldCost")} hint={t("optional")}>
              <CurrencyInput
                value={draft.cost ?? undefined}
                onValueChange={(v) => set("cost", v ?? null)}
                currency={draft.currency}
                          decimalScale={priceDecimals}
                placeholder="0.00"
                className="h-10"
              />
            </Field>
            <Field label={t("margin")}>
              <div className="border-input bg-muted/50 text-muted-foreground flex h-10 items-center rounded-xl border px-4 text-sm font-semibold">
                {margin}
              </div>
            </Field>
          </div>
          <p className="text-muted-foreground/70 text-xs font-semibold">
            {t("costHint")}
          </p>
        </Block>
      ) : step === "variants" ? (
        <div className="space-y-6">
        <Block title={t("secVariants")}>
          <p className="text-muted-foreground text-sm font-semibold">
            {t("libraryHint")}
          </p>

          <div className="space-y-3">
            {draft.options.map((o, idx) => (
              <OptionCard
                key={o.id}
                option={o}
                onChangeName={(name) => updateOption(idx, { ...o, name })}
                onChangeValues={(values) => {
                  updateOption(idx, { ...o, values });
                  syncLibrary(o.name, values);
                }}
                onRemove={() =>
                  setOptions(draft.options.filter((x) => x.id !== o.id))
                }
                t={t}
              />
            ))}

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" className="h-10 gap-2 rounded-xl">
                    <Plus className="size-4" />
                    {t("addOption")}
                  </Button>
                }
              />
              <DropdownMenuContent align="start" className="w-64 rounded-xl">
                {availablePresets.map((p) => (
                  <DropdownMenuItem key={p.id} onClick={() => addFromPreset(p)}>
                    <span className="flex-1 font-semibold">{p.name}</span>
                    <span className="text-muted-foreground/70 truncate text-xs">
                      {p.values.join(", ")}
                    </span>
                  </DropdownMenuItem>
                ))}
                {availablePresets.length > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem onClick={addCustomOption}>
                  <Plus className="size-4" />
                  {t("customOption")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {draft.variants.length > 0 ? (
            <div className="border-border overflow-hidden rounded-2xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs font-bold">
                  <tr>
                    <th className="px-3 py-2 text-left">{t("col.image")}</th>
                    <th className="px-3 py-2 text-left">{t("col.variant")}</th>
                    <th className="px-3 py-2 text-left">{t("col.vprice")}</th>
                    <th className="px-3 py-2 text-left">{t("col.vpromo")}</th>
                    <th className="px-3 py-2 text-left">{t("col.sku")}</th>
                    <th className="px-3 py-2 text-left">{t("col.stock")}</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {draft.variants.map((v, idx) => (
                    <tr key={v.id}>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          aria-label={t("col.image")}
                          onClick={() => setVariantImgIdx(idx)}
                          className="border-input hover:border-primary/50 grid size-9 place-items-center overflow-hidden rounded-lg border text-lg"
                        >
                          {(() => {
                            const m = draft.media.find((mm) => mm.id === v.image);
                            if (m?.url)
                              // eslint-disable-next-line @next/next/no-img-element
                              return <img src={m.url} alt="" className="size-full object-cover" />;
                            if (m?.emoji) return <span>{m.emoji}</span>;
                            return <ImagePlus className="text-muted-foreground size-4" />;
                          })()}
                        </button>
                      </td>
                      <td className="px-3 py-2 font-bold">{v.combo.join(" / ")}</td>
                      <td className="px-3 py-2">
                        <CurrencyInput
                          value={v.price}
                          onValueChange={(val) => {
                            const next = [...draft.variants];
                            next[idx] = { ...v, price: val ?? 0 };
                            set("variants", next);
                          }}
                          currency={draft.currency}
                          decimalScale={priceDecimals}
                          placeholder="0.00"
                          className="h-9 w-28"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <CurrencyInput
                          value={v.promoPrice ?? undefined}
                          onValueChange={(val) => {
                            const next = [...draft.variants];
                            next[idx] = { ...v, promoPrice: val ?? null };
                            set("variants", next);
                          }}
                          currency={draft.currency}
                          decimalScale={priceDecimals}
                          placeholder="—"
                          className="h-9 w-28"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={v.sku}
                          onChange={(e) => {
                            const next = [...draft.variants];
                            next[idx] = { ...v, sku: e.target.value };
                            set("variants", next);
                          }}
                          placeholder="SKU-001"
                          className="h-9 w-28"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <NumberInput
                          value={v.stock ?? undefined}
                          onValueChange={(val) => {
                            const next = [...draft.variants];
                            next[idx] = { ...v, stock: val ?? null };
                            set("variants", next);
                          }}
                          placeholder="∞"
                          className="h-9 w-24"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground/70 text-sm">{t("noVariants")}</p>
          )}
        </Block>
        {draft.variants.length > 0 ? (
          <Block title={t("secRecipe")} divided>
            <p className="text-muted-foreground text-sm font-semibold">
              {t("recipeHint")}
            </p>
            <RecipeEditor
              variants={draft.variants}
              onChange={(next) => set("variants", next)}
            />
            <Field label={t("recipe.notes")} hint={t("recipe.notesHint")}>
              <RichTextEditor
                value={draft.recipeNotes}
                onValueChange={(html) => set("recipeNotes", html)}
              />
            </Field>
          </Block>
        ) : null}
        <Block title={t("secAddons")} divided>
          <p className="text-muted-foreground text-sm font-semibold">{t("addonsHint")}</p>
          <AddonGroupsEditor
            groups={draft.addonGroups}
            onChange={(next) => set("addonGroups", next)}
          />
        </Block>
        </div>
      ) : step === "inventory" ? (
        <div className="space-y-6">
          <Block title={t("secType")}>
            <SegmentedControl<ProductType>
              value={draft.type}
              onValueChange={(v) => set("type", v)}
              options={[
                { value: "physical", label: t("typePhysical"), icon: Box },
                { value: "digital", label: t("typeDigital"), icon: Laptop },
              ]}
            />
          </Block>

          <Block title={t("secInventory")} divided>
            <Field label={t("stock")}>
              <SegmentedControl<StockMode>
                value={draft.stockMode}
                onValueChange={(v) => set("stockMode", v)}
                options={[
                  { value: "infinite", label: t("stockInfinite") },
                  { value: "limited", label: t("stockLimited") },
                ]}
              />
            </Field>
            {draft.stockMode === "limited" ? (
              <Field label={t("quantity")}>
                <NumberInput
                  value={draft.stock}
                  onValueChange={(v) => set("stock", v ?? 0)}
                  placeholder="0"
                  className="h-10 w-40"
                />
              </Field>
            ) : null}
          </Block>

          <Block title={t("secCodes")} divided>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("sku")} hint={t("optional")}>
                <Input
                  value={draft.sku}
                  onChange={(e) => set("sku", e.target.value)}
                  placeholder="SKU-001"
                  className="h-10"
                />
              </Field>
              <Field label={t("barcode")} hint={t("optional")}>
                <Input
                  value={draft.barcode}
                  onChange={(e) => set("barcode", e.target.value)}
                  placeholder="7501234567890"
                  className="h-10"
                />
              </Field>
            </div>
          </Block>

          {draft.type === "physical" ? (
            <Block title={t("secShipping")} divided>
              <p className="text-muted-foreground text-sm font-semibold">
                {t("shippingHint")}
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label={t("weight")}>
                  <NumberInput
                    value={draft.weight ?? undefined}
                    onValueChange={(v) => set("weight", v ?? null)}
                    decimalScale={2}
                    suffix=" kg"
                    placeholder="0.00"
                    className="h-10"
                  />
                </Field>
                <Field label={t("depth")}>
                  <NumberInput
                    value={draft.depth ?? undefined}
                    onValueChange={(v) => set("depth", v ?? null)}
                    suffix=" cm"
                    placeholder="0"
                    className="h-10"
                  />
                </Field>
                <Field label={t("width")}>
                  <NumberInput
                    value={draft.width ?? undefined}
                    onValueChange={(v) => set("width", v ?? null)}
                    suffix=" cm"
                    placeholder="0"
                    className="h-10"
                  />
                </Field>
                <Field label={t("height")}>
                  <NumberInput
                    value={draft.height ?? undefined}
                    onValueChange={(v) => set("height", v ?? null)}
                    suffix=" cm"
                    placeholder="0"
                    className="h-10"
                  />
                </Field>
              </div>
            </Block>
          ) : null}
        </div>
      ) : step === "organization" ? (
        <div className="space-y-6">
          <Block title={t("secCategories")}>
            <p className="text-muted-foreground text-sm font-semibold">
              {t("categoriesHint")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {realCategories.map((c) => {
                const on = draft.categoryIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      set(
                        "categoryIds",
                        on
                          ? draft.categoryIds.filter((x) => x !== c.id)
                          : [...draft.categoryIds, c.id],
                      )
                    }
                    className={`h-8 rounded-full px-3 text-xs font-bold transition-colors ${
                      on
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setCategoriesOpen(true)}
              className="text-primary inline-flex items-center gap-1.5 text-sm font-bold"
            >
              <FolderTree className="size-4" />
              {t("manageCategories")}
            </button>
          </Block>

          <StoreAvailabilityField
            value={draft.storeIds}
            onChange={(v) => set("storeIds", v)}
          />

          <Block title={t("secFeatured")} divided>
            <p className="text-muted-foreground text-sm font-semibold">
              {t("featuredHint")}
            </p>
            {draft.featuredSections.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {draft.featuredSections.map((sid) => (
                  <span
                    key={sid}
                    className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                  >
                    {sections.find((s) => s.id === sid)?.label ?? sid}
                    <button
                      type="button"
                      aria-label={t("delete")}
                      onClick={() =>
                        set(
                          "featuredSections",
                          draft.featuredSections.filter((x) => x !== sid),
                        )
                      }
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <Button
              variant="outline"
              className="h-10 gap-2 rounded-xl"
              onClick={() => setSectionsOpen(true)}
            >
              <Plus className="size-4" />
              {t("chooseSections")}
            </Button>
          </Block>

          <Block title={t("secMarketing")} divided>
            <p className="text-muted-foreground text-sm font-semibold">
              {t("marketingHint")}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={t("mpn")} hint={t("optional")}>
                <Input
                  value={draft.mpn}
                  onChange={(e) => set("mpn", e.target.value)}
                  placeholder="MPN-12345"
                  className="h-10"
                />
              </Field>
              <Field label={t("ageRange")}>
                <Select
                  value={draft.ageRange}
                  onValueChange={(v) => set("ageRange", v ?? "all")}
                >
                  <SelectTrigger size="lg" className="w-full text-sm">
                    <SelectValue>{(v) => t(`age.${v as string}`)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {AGE_RANGES.map((a) => (
                      <SelectItem key={a} value={a}>
                        {t(`age.${a}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("genderLabel")}>
                <Select
                  value={draft.gender}
                  onValueChange={(v) => set("gender", v ?? "unisex")}
                >
                  <SelectTrigger size="lg" className="w-full text-sm">
                    <SelectValue>{(v) => t(`gender.${v as string}`)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {t(`gender.${g}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </Block>

          <Block title={t("secSeo")} ai divided>
            <Field label={t("tags")} hint={t("tagsHint")}>
              <Input
                value={draft.tags.join(", ")}
                onChange={(e) =>
                  set(
                    "tags",
                    e.target.value.split(",").map((x) => x.trim()).filter(Boolean),
                  )
                }
                placeholder={t("tagsPlaceholder")}
                className="h-10"
              />
            </Field>
            <Field label={t("brand")}>
              <Input
                value={draft.brand}
                onChange={(e) => set("brand", e.target.value)}
                placeholder={t("brandPlaceholder")}
                className="h-10"
              />
            </Field>
            <Field label={t("seoTitle")} hint={`${draft.seoTitle.length}/70`}>
              <Input
                value={draft.seoTitle}
                maxLength={70}
                onChange={(e) => set("seoTitle", e.target.value)}
                placeholder={t("seoTitlePlaceholder")}
                className="h-10"
              />
            </Field>
            <Field label={t("seoDesc")} hint={`${draft.seoDescription.length}/160`}>
              <Textarea
                value={draft.seoDescription}
                maxLength={160}
                onChange={(e) => set("seoDescription", e.target.value)}
                placeholder={t("seoDescPlaceholder")}
                rows={2}
                className="min-h-20 rounded-xl"
              />
            </Field>
            <Field label={t("slug")}>
              <div className="border-input bg-input/30 focus-within:border-ring focus-within:ring-ring/50 flex h-10 items-center overflow-hidden rounded-xl border focus-within:ring-3">
                <span className="text-muted-foreground/70 pl-4 text-sm whitespace-nowrap">
                  /productos/
                </span>
                <input
                  value={draft.slug}
                  onChange={(e) => set("slug", slugify(e.target.value))}
                  placeholder="smoothie-maracuya"
                  className="h-full flex-1 bg-transparent pr-4 pl-1 text-sm outline-none"
                />
              </div>
            </Field>
          </Block>
        </div>
      ) : (
        <Block title={t("reviewTitle")}>
          <dl className="divide-border divide-y text-sm">
            <ReviewRow label={t("fieldName")} value={draft.name || "—"} />
            <ReviewRow label={t("col.price")} value={priceLabel(draft, locale)} />
            <ReviewRow
              label={t("secCategories")}
              value={
                draft.categoryIds
                  .map((id) => realCategories.find((c) => c.id === id)?.label ?? id)
                  .join(", ") || "—"
              }
            />
            <ReviewRow
              label={t("secAddons")}
              value={draft.addonGroups.map((g) => g.name.trim() || "—").join(", ") || "—"}
            />
            <ReviewRow
              label={t("secFeatured")}
              value={
                draft.featuredSections
                  .map((sid) => sections.find((s) => s.id === sid)?.label ?? sid)
                  .join(", ") || "—"
              }
            />
          </dl>

          {/* Variants at a glance: price (+ promo), stock. */}
          {draft.variants.length > 0 ? (
            <div className="border-border mt-4 overflow-hidden rounded-2xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs font-bold">
                  <tr>
                    <th className="px-3 py-2 text-left">{t("col.variant")}</th>
                    <th className="px-3 py-2 text-right">{t("col.vprice")}</th>
                    <th className="px-3 py-2 text-right">{t("col.stock")}</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {draft.variants.map((v) => (
                    <tr key={v.id}>
                      <td className="px-3 py-2 font-semibold">
                        {v.combo.join(" / ") || t("recipe.baseVariant")}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {v.promoPrice != null && v.promoPrice > 0 ? (
                          <>
                            <span className="font-bold">{fmtPrice(v.promoPrice)}</span>{" "}
                            <span className="text-muted-foreground/60 line-through">
                              {fmtPrice(v.price)}
                            </span>
                          </>
                        ) : (
                          <span className="font-bold">{fmtPrice(v.price)}</span>
                        )}
                      </td>
                      <td className="text-muted-foreground px-3 py-2 text-right">
                        {v.stock == null ? "∞" : v.stock}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Block>
      )}

      {/* Categories manager — in a modal so the product draft isn't lost */}
      <ResponsiveModal open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-2xl">
          <div className="flex flex-col px-6 pt-2 pb-6">
            <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
              {t("cat.title")}
            </ResponsiveModalTitle>
            <ResponsiveModalDescription className="text-muted-foreground mt-1 mb-4 text-sm">
              {t("cat.subtitle")}
            </ResponsiveModalDescription>
            <CategoriesManager />
            <Button
              className="mt-4 h-10 w-full rounded-xl font-semibold"
              onClick={() => setCategoriesOpen(false)}
            >
              {t("done")}
            </Button>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* Variant image picker — pick a product image, upload a custom one, or clear */}
      <ResponsiveModal
        open={variantImgIdx !== null}
        onOpenChange={(o) => !o && setVariantImgIdx(null)}
      >
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          <div className="flex flex-col px-6 pt-2 pb-6">
            <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
              {t("variantImageTitle")}
            </ResponsiveModalTitle>
            <div className="mt-4 grid grid-cols-4 gap-2.5">
              {/* Upload */}
              <label className="border-primary/40 text-primary hover:bg-primary/5 flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-[0.625rem] font-bold">
                <ImagePlus className="size-5" />
                {uploading ? t("uploading") : t("variantImageUpload")}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f != null && variantImgIdx !== null) void uploadVariantImage(variantImgIdx, f);
                    e.target.value = "";
                  }}
                />
              </label>
              {/* No image */}
              <button
                type="button"
                onClick={() => {
                  if (variantImgIdx !== null) setVariantImage(variantImgIdx, null);
                  setVariantImgIdx(null);
                }}
                className="border-border text-muted-foreground hover:bg-muted flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border text-[0.625rem] font-bold"
              >
                <X className="size-5" />
                {t("noImage")}
              </button>
              {/* Existing product images */}
              {draft.media.map((m) => {
                const active =
                  variantImgIdx !== null && draft.variants[variantImgIdx]?.image === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      if (variantImgIdx !== null) setVariantImage(variantImgIdx, m.id);
                      setVariantImgIdx(null);
                    }}
                    className={`grid aspect-square place-items-center overflow-hidden rounded-xl border text-2xl ${active ? "border-primary border-2" : "border-border"}`}
                  >
                    {m.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt="" className="size-full object-cover" />
                    ) : (
                      <span>{m.emoji || "🖼️"}</span>
                    )}
                  </button>
                );
              })}
            </div>
            {draft.media.length === 0 ? (
              <p className="text-muted-foreground mt-3 text-xs font-semibold">
                {t("variantImageEmpty")}
              </p>
            ) : null}
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* Featured-sections picker — searchable + create new */}
      <ResponsiveModal open={sectionsOpen} onOpenChange={setSectionsOpen}>
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          <div className="flex flex-col px-6 pt-2 pb-6">
            <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
              {t("secFeatured")}
            </ResponsiveModalTitle>
            <ResponsiveModalDescription className="text-muted-foreground mt-1 text-sm">
              {t("featuredHint")}
            </ResponsiveModalDescription>
            <div className="border-input bg-input/30 mt-4 flex h-10 items-center gap-2 rounded-xl border px-3">
              <Search className="text-muted-foreground size-4" />
              <input
                value={sectionQuery}
                onChange={(e) => setSectionQuery(e.target.value)}
                placeholder={t("searchSection")}
                className="h-full flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
              {sections
                .filter((s) =>
                  s.label.toLowerCase().includes(sectionQuery.trim().toLowerCase()),
                )
                .map((s) => (
                  <li key={s.id}>
                    <label className="border-border flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold">
                      <Checkbox
                        checked={draft.featuredSections.includes(s.id)}
                        onCheckedChange={(c) =>
                          set(
                            "featuredSections",
                            c === true
                              ? [...draft.featuredSections, s.id]
                              : draft.featuredSections.filter((x) => x !== s.id),
                          )
                        }
                      />
                      <span className="flex-1">{s.label}</span>
                      <Badge variant="secondary" className="text-muted-foreground">
                        {t("sectionLimit", { n: 0 })}
                      </Badge>
                    </label>
                  </li>
                ))}
            </ul>
            <div className="border-border mt-3 flex items-center gap-2 border-t pt-3">
              <Input
                value={newSection}
                onChange={(e) => setNewSection(e.target.value)}
                placeholder={t("newSectionPlaceholder")}
                className="h-10 flex-1"
              />
              <Button
                variant="outline"
                className="h-10 gap-1.5 rounded-xl"
                disabled={!newSection.trim()}
                onClick={() => {
                  const label = newSection.trim();
                  if (!label) return;
                  const sid = `s_${slugify(label) || Date.now()}`;
                  setSections((prev) => [...prev, { id: sid, label }]);
                  set("featuredSections", [...draft.featuredSections, sid]);
                  setNewSection("");
                }}
              >
                <Plus className="size-4" />
                {t("createSection")}
              </Button>
            </div>
            <Button
              className="mt-4 h-10 w-full rounded-xl font-semibold"
              onClick={() => setSectionsOpen(false)}
            >
              {t("done")}
            </Button>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </WizardShell>
  );
}

function priceLabel(draft: ProductDraft, locale: string): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: draft.currency,
    }).format(n);
  if (draft.variants.length > 0) {
    const min = Math.min(...draft.variants.map((v) => v.price));
    return fmt(min);
  }
  return draft.price != null ? fmt(draft.price) : "—";
}

function ProductPreview({
  draft,
  locale,
  t,
}: {
  draft: ProductDraft;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const variantPrices = draft.variants.map((v) => v.price);
  const min = variantPrices.length ? Math.min(...variantPrices) : null;
  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: draft.currency,
    }).format(n);
  return (
    <div className="preview-customer bg-card border-border rounded-3xl border p-4 shadow-sm">
      <div className="bg-muted/50 grid aspect-square place-items-center overflow-hidden rounded-2xl text-6xl">
        {draft.media[0]?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={draft.media[0].url} alt="" className="size-full object-cover" />
        ) : (
          (draft.media[0]?.emoji ?? "🛍️")
        )}
      </div>
      <div className="mt-3 font-bold">
        {draft.name || t("previewNamePlaceholder")}
      </div>
      <div className="text-primary mt-0.5 font-extrabold">
        {(() => {
          const regular = min ?? draft.price;
          if (regular == null) return t("noPrice");
          const promo = draft.promoPrice;
          const hasPromo = promo != null && promo > 0 && promo < regular;
          const shown = hasPromo ? promo : regular;
          const label = min != null ? t("priceFrom", { price: fmt(shown) }) : fmt(shown);
          return hasPromo ? (
            <span>
              <span className="text-muted-foreground/60 mr-1.5 font-semibold line-through">
                {fmt(regular)}
              </span>
              {label}
            </span>
          ) : (
            label
          );
        })()}
      </div>
      {draft.categoryIds.length > 0 ? (
        <div className="text-muted-foreground/70 mt-2 text-xs font-semibold">
          {t("categoriesN", { n: draft.categoryIds.length })}
        </div>
      ) : null}
    </div>
  );
}

function OptionCard({
  option,
  onChangeName,
  onChangeValues,
  onRemove,
  t,
}: {
  option: ProductOption;
  onChangeName: (name: string) => void;
  onChangeValues: (values: string[]) => void;
  onRemove: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const tags: Tag[] = option.values.map((v, i) => ({ id: String(i), text: v }));
  return (
    <div className="border-border space-y-2 rounded-2xl border p-3">
      <div className="flex items-center gap-2">
        <Input
          value={option.name}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder={t("optionNamePlaceholder")}
          className="h-9 flex-1 font-semibold"
        />
        <Button
          variant="outline"
          size="icon"
          aria-label={t("removeOption")}
          className="text-destructive hover:bg-destructive/10 size-9 flex-none rounded-lg"
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <TagInput
        value={tags}
        onChange={(next) => onChangeValues(next.map((tag) => tag.text))}
        placeholder={t("optionValuesPlaceholder")}
      />
    </div>
  );
}

function Block({
  title,
  ai,
  divided,
  children,
}: {
  title: string;
  ai?: boolean;
  divided?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("Products");
  return (
    <section className={divided ? "border-border space-y-4 border-t pt-6" : "space-y-4"}>
      <div className="flex items-center gap-2">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {ai ? (
          <button
            type="button"
            className="text-primary inline-flex items-center gap-1 text-xs font-bold"
          >
            <Sparkles className="size-3.5" />
            {t("generateAI")}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {hint ? (
          <span className="text-muted-foreground/70 text-xs font-semibold">
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground font-semibold">{label}</dt>
      <dd className="truncate text-right font-bold">{value}</dd>
    </div>
  );
}
