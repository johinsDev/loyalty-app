"use client";

import {
  Badge,
  Button,
  Checkbox,
  CurrencyInput,
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
import { useTranslations } from "next-intl";
import { type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";

import { Link, useRouter } from "@/i18n/navigation";

import {
  AGE_RANGES,
  buildVariants,
  categoryRefs,
  CURRENCIES,
  emptyProductDraft,
  FEATURED_SECTIONS,
  GENDERS,
  getProductDraft,
  PRODUCT_EMOJIS,
  type ProductDraft,
  type ProductOption,
  type ProductType,
  type StockMode,
} from "../data";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Product editor — a Shopify/Tiendanube-style long form: name + rich
 * description, photos & video, pricing, options→variants matrix, type,
 * inventory, codes, shipping, marketing meta, multiple categories, featured
 * sections, and tags/brand/SEO. Design-first / hardcoded; save toasts + returns
 * to the list. The seam is the Phase A product catalog + storage channel.
 */
export function ProductEditor({ id }: { id?: string }) {
  const t = useTranslations("Products");
  const router = useRouter();
  const [draft, setDraft] = useState<ProductDraft>(
    id ? getProductDraft(id) : emptyProductDraft,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [sectionQuery, setSectionQuery] = useState("");
  const [newSection, setNewSection] = useState("");
  const [sections, setSections] = useState(() =>
    FEATURED_SECTIONS.map((s) => ({ id: s as string, label: t(`section.${s}`) })),
  );

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    set("media", [
      ...draft.media,
      ...files.map((_, n) => ({ id: `m_up_${Date.now()}_${n}`, emoji: "🖼️" })),
    ]);
    e.target.value = "";
  };

  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setOptions = (options: ProductOption[]) =>
    setDraft((d) => ({
      ...d,
      options,
      variants: buildVariants(options, d.variants),
    }));

  const onSave = () => {
    toast.success(
      id ? t("updated", { name: draft.name }) : t("created", { name: draft.name }),
    );
    router.push("/products");
  };

  const margin =
    draft.price && draft.cost && draft.price > 0
      ? `${Math.round(((draft.price - draft.cost) / draft.price) * 100)}%`
      : "—";

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {id ? t("editTitle") : t("newTitle")}
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => router.push("/products")}
          >
            {t("cancel")}
          </Button>
          <Button className="h-10 rounded-xl font-semibold" onClick={onSave}>
            {id ? t("saveChanges") : t("save")}
          </Button>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {/* Name & description */}
        <Section title={t("secName")} ai>
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
        </Section>

        {/* Photos & video */}
        <Section title={t("secMedia")}>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {draft.media.map((m) => (
              <div
                key={m.id}
                className="bg-muted/50 group relative grid aspect-square place-items-center rounded-2xl text-3xl"
              >
                {m.emoji}
                <button
                  type="button"
                  aria-label={t("delete")}
                  onClick={() =>
                    set(
                      "media",
                      draft.media.filter((x) => x.id !== m.id),
                    )
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
            className="border-border bg-primary/5 hover:bg-primary/10 mt-2 grid w-full place-items-center rounded-2xl border border-dashed py-6 text-center transition-colors"
          >
            <ImagePlus className="text-primary size-6" />
            <span className="text-primary mt-1 text-sm font-bold">
              {t("mediaHint")}
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
          <div className="mt-2 flex flex-wrap gap-1.5">
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
        </Section>

        {/* Pricing */}
        <Section title={t("secPrices")}>
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
                placeholder="0.00"
                className="h-10"
              />
            </Field>
            <Field label={t("fieldPromoPrice")} hint={t("optional")}>
              <CurrencyInput
                value={draft.promoPrice ?? undefined}
                onValueChange={(v) => set("promoPrice", v ?? null)}
                currency={draft.currency}
                placeholder="0.00"
                className="h-10"
              />
            </Field>
          </div>
          <label className="mt-1 flex items-center gap-2.5 text-sm font-medium">
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
        </Section>

        {/* Variants */}
        <Section title={t("secVariants")}>
          <p className="text-muted-foreground text-sm font-semibold">
            {t("variantsHint")}
          </p>
          <div className="space-y-3">
            {draft.options.map((o, idx) => (
              <div
                key={o.id}
                className="border-border space-y-2 rounded-2xl border p-3"
              >
                <div className="flex items-center gap-2">
                  <Input
                    value={o.name}
                    onChange={(e) => {
                      const next = [...draft.options];
                      next[idx] = { ...o, name: e.target.value };
                      setOptions(next);
                    }}
                    placeholder={t("optionNamePlaceholder")}
                    className="h-10 flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={t("removeOption")}
                    className="text-destructive hover:bg-destructive/10 size-10 flex-none rounded-xl"
                    onClick={() =>
                      setOptions(draft.options.filter((x) => x.id !== o.id))
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <Input
                  value={o.values.join(", ")}
                  onChange={(e) => {
                    const next = [...draft.options];
                    next[idx] = {
                      ...o,
                      values: e.target.value
                        .split(",")
                        .map((v) => v.trim())
                        .filter(Boolean),
                    };
                    setOptions(next);
                  }}
                  placeholder={t("optionValuesPlaceholder")}
                  className="h-10"
                />
              </div>
            ))}
            <Button
              variant="outline"
              className="h-10 gap-2 rounded-xl"
              onClick={() =>
                setOptions([
                  ...draft.options,
                  { id: `o_${draft.options.length}_${Date.now()}`, name: "", values: [] },
                ])
              }
            >
              <Plus className="size-4" />
              {t("addOption")}
            </Button>
          </div>

          {draft.variants.length > 0 ? (
            <div className="border-border overflow-hidden rounded-2xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs font-bold">
                  <tr>
                    <th className="px-3 py-2 text-left">{t("col.variant")}</th>
                    <th className="px-3 py-2 text-left">{t("col.vprice")}</th>
                    <th className="px-3 py-2 text-left">{t("col.sku")}</th>
                    <th className="px-3 py-2 text-left">{t("col.stock")}</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {draft.variants.map((v, idx) => (
                    <tr key={v.id}>
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
                          placeholder="0.00"
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
                          className="h-9 w-24"
                          placeholder="∞"
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
        </Section>

        {/* Type */}
        <Section title={t("secType")}>
          <SegmentedControl<ProductType>
            value={draft.type}
            onValueChange={(v) => set("type", v)}
            options={[
              { value: "physical", label: t("typePhysical"), icon: Box },
              { value: "digital", label: t("typeDigital"), icon: Laptop },
            ]}
          />
        </Section>

        {/* Inventory */}
        <Section title={t("secInventory")}>
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
                className="h-10 w-40"
              />
            </Field>
          ) : null}
        </Section>

        {/* Codes */}
        <Section title={t("secCodes")}>
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
        </Section>

        {/* Shipping */}
        {draft.type === "physical" ? (
          <Section title={t("secShipping")}>
            <p className="text-muted-foreground text-sm font-semibold">
              {t("shippingHint")}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label={t("weight")}>
                <NumberInput
                  value={draft.weight ?? undefined}
                  onValueChange={(v) => set("weight", v ?? null)}
                  className="h-10"
                  decimalScale={2}
                  suffix=" kg"
                />
              </Field>
              <Field label={t("depth")}>
                <NumberInput
                  value={draft.depth ?? undefined}
                  onValueChange={(v) => set("depth", v ?? null)}
                  className="h-10"
                  suffix=" cm"
                />
              </Field>
              <Field label={t("width")}>
                <NumberInput
                  value={draft.width ?? undefined}
                  onValueChange={(v) => set("width", v ?? null)}
                  className="h-10"
                  suffix=" cm"
                />
              </Field>
              <Field label={t("height")}>
                <NumberInput
                  value={draft.height ?? undefined}
                  onValueChange={(v) => set("height", v ?? null)}
                  className="h-10"
                  suffix=" cm"
                />
              </Field>
            </div>
          </Section>
        ) : null}

        {/* Marketing meta */}
        <Section title={t("secMarketing")}>
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
              <Select value={draft.ageRange} onValueChange={(v) => set("ageRange", v ?? "all")}>
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
            <Field label={t("gender")}>
              <Select value={draft.gender} onValueChange={(v) => set("gender", v ?? "unisex")}>
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
        </Section>

        {/* Categories */}
        <Section title={t("secCategories")}>
          <p className="text-muted-foreground text-sm font-semibold">
            {t("categoriesHint")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {categoryRefs().map((c) => {
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
          <Link
            href="/products/categories"
            className="text-primary inline-flex items-center gap-1.5 text-sm font-bold"
          >
            <FolderTree className="size-4" />
            {t("manageCategories")}
          </Link>
        </Section>

        {/* Featured sections */}
        <Section title={t("secFeatured")}>
          <p className="text-muted-foreground text-sm font-semibold">
            {t("featuredHint")}
          </p>
          {draft.featuredSections.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {draft.featuredSections.map((id) => (
                <span
                  key={id}
                  className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                >
                  {sections.find((s) => s.id === id)?.label ?? id}
                  <button
                    type="button"
                    aria-label={t("delete")}
                    onClick={() =>
                      set(
                        "featuredSections",
                        draft.featuredSections.filter((x) => x !== id),
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
        </Section>

        {/* Tags, brand & SEO */}
        <Section title={t("secSeo")} ai>
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
        </Section>
      </div>

      {/* Featured-sections picker — searchable + create new (sections will be
          manageable later; this lets the owner add one on the fly). */}
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
                  s.label
                    .toLowerCase()
                    .includes(sectionQuery.trim().toLowerCase()),
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
    </div>
  );
}

function Section({
  title,
  ai,
  children,
}: {
  title: string;
  ai?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("Products");
  return (
    <section className="bg-card border-border space-y-4 rounded-3xl border p-6 shadow-sm">
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
