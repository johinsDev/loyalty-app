"use client";

import { formatDate } from "@loyalty/date";
import {
  Badge,
  BackgroundPicker,
  Button,
  Checkbox,
  DatePicker,
  Input,
  Label,
  NumberInput,
  RichTextEditor,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { WizardShell } from "@/components/wizard-shell";
import { FileUpload } from "@/features/storage/components/file-upload";
import { useUploadImage } from "@/features/storage/hooks/use-upload-image";
import { useRouter } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

import { HourSelect } from "./hour-select";
import { ProductCombobox } from "./product-combobox";

const STEPS = ["content", "design", "benefit", "rules", "schedule", "review"] as const;
type Step = (typeof STEPS)[number];

const TYPES = ["percentage", "fixed", "nForM", "freeItem", "pointsMultiplier"] as const;
type PromoType = (typeof TYPES)[number];
const SCOPES = ["order", "products", "categories"] as const;
type ScopeKind = (typeof SCOPES)[number];
const TIERS = ["hoja", "flor", "oro"] as const;
type TierKey = (typeof TIERS)[number];
type AudienceType = "all" | "tier" | "specific";
const CHANNELS = ["push", "database", "realtime"] as const;
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const centsToUnits = (c: number | null | undefined): number | undefined =>
  c == null ? undefined : Math.round(c) / 100;
const unitsToCents = (u: number | undefined): number | undefined =>
  u == null ? undefined : Math.round(u * 100);

type Form = {
  name: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  badgeLabel: string;
  icon: string;
  category: string;
  featured: boolean;
  backgroundCss: string;
  mainImageUrl: string | null;
  type: PromoType;
  percent?: number;
  maxDiscountUnits?: number;
  amountUnits?: number;
  buyQty?: number;
  payQty?: number;
  multiplier?: number;
  freeItemId: string;
  scopeKind: ScopeKind;
  productIds: string[];
  categoryIds: string[];
  minPurchaseUnits?: number;
  maxUsesTotal?: number;
  maxPerCustomer?: number;
  firstPurchaseOnly: boolean;
  daysOfWeek: number[];
  hoursFrom: string;
  hoursTo: string;
  audienceType: AudienceType;
  tierKey: TierKey;
  audienceCustomerIds: string[];
  stackable: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

const EMPTY: Form = {
  name: "",
  slug: "",
  shortDescription: "",
  longDescription: "",
  badgeLabel: "",
  icon: "",
  category: "",
  featured: false,
  backgroundCss: "linear-gradient(135deg, #1BAD9D, #0e6f64)",
  mainImageUrl: null,
  type: "percentage",
  percent: 10,
  buyQty: 2,
  payQty: 1,
  multiplier: 2,
  freeItemId: "",
  scopeKind: "order",
  productIds: [],
  categoryIds: [],
  firstPurchaseOnly: false,
  daysOfWeek: [],
  hoursFrom: "",
  hoursTo: "",
  audienceType: "all",
  tierKey: "oro",
  audienceCustomerIds: [],
  stackable: false,
  startsAt: null,
  endsAt: null,
};

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Promotion editor (content → design → benefit → rules → schedule → review). On
 * "new" it creates a draft immediately; each Next persists the relevant fields
 * via `promociones.update`, and Finish publishes. The schedule step manages
 * scheduled notifications (one-shot or weekly), delivered by Trigger.dev.
 */
export function PromoWizard({ id }: { id?: string }) {
  const t = useTranslations("Promotions");
  const locale = useLocale();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const uploadImage = useUploadImage();

  const [promoId, setPromoId] = useState<string | undefined>(id);
  const [form, setForm] = useState<Form>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(Boolean(id));
  const [stepIndex, setStepIndex] = useState(0);
  const seeded = useRef(false);
  const creating = useRef(false);

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // New promo → create a draft once.
  const createMut = useMutation(trpc.promociones.create.mutationOptions());
  useEffect(() => {
    if (id || promoId || creating.current) return;
    creating.current = true;
    createMut.mutate(undefined, {
      onSuccess: (res) => {
        setPromoId(res.id);
        seeded.current = true;
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, promoId]);

  // Edit promo → load + seed once.
  const getQuery = useQuery({
    ...trpc.promociones.get.queryOptions({ id: id ?? "" }),
    enabled: Boolean(id),
  });
  useEffect(() => {
    if (!id || !getQuery.data || seeded.current) return;
    const p = getQuery.data;
    const b = (p.benefit ?? {}) as Record<string, unknown>;
    const c = (p.conditions ?? {}) as Record<string, unknown>;
    const scope = (p.scope ?? {}) as { productIds?: string[]; categoryIds?: string[] };
    const freeRef = (b.freeRef ?? {}) as { id?: string };
    setForm({
      ...EMPTY,
      name: p.name ?? "",
      slug: p.slug && !p.slug.startsWith("borrador-") ? p.slug : "",
      shortDescription: p.shortDescription ?? "",
      longDescription: p.longDescription ?? "",
      badgeLabel: p.badgeLabel ?? "",
      icon: p.icon ?? "",
      category: p.category ?? "",
      featured: p.featured ?? false,
      backgroundCss: p.backgroundCss ?? EMPTY.backgroundCss,
      mainImageUrl: p.mainImageUrl,
      type: (p.type as PromoType) ?? "percentage",
      percent: typeof b.percent === "number" ? b.percent : EMPTY.percent,
      maxDiscountUnits: centsToUnits(b.maxDiscountCents as number | undefined),
      amountUnits: centsToUnits(b.amountCents as number | undefined),
      buyQty: typeof b.buyQty === "number" ? b.buyQty : EMPTY.buyQty,
      payQty: typeof b.payQty === "number" ? b.payQty : EMPTY.payQty,
      multiplier: typeof b.multiplier === "number" ? b.multiplier : EMPTY.multiplier,
      freeItemId: freeRef.id ?? "",
      scopeKind: (p.scopeKind as ScopeKind) ?? "order",
      productIds: scope.productIds ?? [],
      categoryIds: scope.categoryIds ?? [],
      minPurchaseUnits: centsToUnits(c.minPurchaseCents as number | undefined),
      maxUsesTotal: c.maxUsesTotal as number | undefined,
      maxPerCustomer: c.maxPerCustomer as number | undefined,
      firstPurchaseOnly: Boolean(c.firstPurchaseOnly),
      daysOfWeek: (c.daysOfWeek as number[] | undefined) ?? [],
      hoursFrom: (c.hoursFrom as string | undefined) ?? "",
      hoursTo: (c.hoursTo as string | undefined) ?? "",
      audienceType: (p.audienceType as AudienceType) ?? "all",
      tierKey: (p.tierKey as TierKey) ?? "oro",
      audienceCustomerIds: p.audienceCustomerIds ?? [],
      stackable: p.stackable ?? false,
      startsAt: p.startsAt,
      endsAt: p.endsAt,
    });
    seeded.current = true;
  }, [id, getQuery.data]);

  const updateMut = useMutation(trpc.promociones.update.mutationOptions());
  const publishMut = useMutation(trpc.promociones.publish.mutationOptions());

  const step = STEPS[stepIndex]!;
  const steps = STEPS.map((key) => ({ key, label: t(`step.${key}`) }));
  const completed = STEPS.slice(0, stepIndex);

  function buildBenefit(): Record<string, unknown> | undefined {
    switch (form.type) {
      case "percentage":
        return {
          percent: form.percent && form.percent >= 1 ? form.percent : 1,
          ...(form.maxDiscountUnits ? { maxDiscountCents: unitsToCents(form.maxDiscountUnits) } : {}),
        };
      case "fixed":
        return { amountCents: unitsToCents(form.amountUnits) ?? 0 };
      case "nForM":
        return { buyQty: form.buyQty ?? 2, payQty: form.payQty ?? 1 };
      case "freeItem":
        return form.freeItemId ? { freeRef: { kind: "product", id: form.freeItemId } } : undefined;
      case "pointsMultiplier":
        return { multiplier: form.multiplier && form.multiplier >= 1 ? form.multiplier : 2 };
    }
  }

  function buildConditions(): Record<string, unknown> {
    const c: Record<string, unknown> = {};
    const min = unitsToCents(form.minPurchaseUnits);
    if (min) c.minPurchaseCents = min;
    if (form.maxUsesTotal) c.maxUsesTotal = form.maxUsesTotal;
    if (form.maxPerCustomer) c.maxPerCustomer = form.maxPerCustomer;
    if (form.firstPurchaseOnly) c.firstPurchaseOnly = true;
    if (form.daysOfWeek.length) c.daysOfWeek = [...form.daysOfWeek].sort();
    if (/^\d{2}:\d{2}$/.test(form.hoursFrom)) c.hoursFrom = form.hoursFrom;
    if (/^\d{2}:\d{2}$/.test(form.hoursTo)) c.hoursTo = form.hoursTo;
    return c;
  }

  async function persistStep(): Promise<boolean> {
    if (!promoId) return false;
    try {
      if (step === "content") {
        await updateMut.mutateAsync({
          id: promoId,
          name: form.name || undefined,
          ...(form.slug ? { slug: form.slug } : {}),
          shortDescription: form.shortDescription || undefined,
          longDescription: form.longDescription || undefined,
          badgeLabel: form.badgeLabel || undefined,
          category: form.category || undefined,
          featured: form.featured,
        });
      } else if (step === "design") {
        await updateMut.mutateAsync({
          id: promoId,
          backgroundCss: form.backgroundCss,
          mainImageUrl: form.mainImageUrl ?? "",
          icon: form.icon || undefined,
        });
      } else if (step === "benefit") {
        const benefit = buildBenefit();
        await updateMut.mutateAsync({
          id: promoId,
          type: form.type,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(benefit ? { benefit: benefit as any } : {}),
          scopeKind: form.scopeKind,
          scope: {
            ...(form.scopeKind === "products" ? { productIds: form.productIds } : {}),
            ...(form.scopeKind === "categories" ? { categoryIds: form.categoryIds } : {}),
          },
        });
      } else if (step === "rules") {
        await updateMut.mutateAsync({
          id: promoId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          conditions: buildConditions() as any,
          audienceType: form.audienceType,
          ...(form.audienceType === "tier" ? { tierKey: form.tierKey } : {}),
          ...(form.audienceType === "specific"
            ? { audienceCustomerIds: form.audienceCustomerIds }
            : {}),
          stackable: form.stackable,
        });
      } else if (step === "schedule") {
        await updateMut.mutateAsync({
          id: promoId,
          startsAt: form.startsAt ?? undefined,
          endsAt: form.endsAt ?? undefined,
        });
      }
      return true;
    } catch {
      toast.error(t("saveError"));
      return false;
    }
  }

  async function onNext() {
    if (step === "review") {
      if (!promoId) return;
      try {
        await publishMut.mutateAsync({ id: promoId });
        await queryClient.invalidateQueries(trpc.promociones.list.queryFilter());
        toast.success(id ? t("updated", { name: form.name }) : t("created", { name: form.name }));
        router.push("/promotions");
      } catch {
        toast.error(t("publishError"));
      }
      return;
    }
    const ok = await persistStep();
    if (ok) setStepIndex((n) => n + 1);
  }

  const busy = createMut.isPending && !promoId;

  return (
    <WizardShell
      title={id ? t("editTitle") : t("newTitle")}
      steps={steps}
      current={step}
      completed={completed}
      onStepSelect={(key) => {
        const idx = STEPS.indexOf(key as Step);
        if (idx <= stepIndex) setStepIndex(idx);
      }}
      onBack={() => setStepIndex((n) => Math.max(0, n - 1))}
      onNext={onNext}
      isFirst={stepIndex === 0}
      isLast={step === "review"}
      finishLabel={id ? t("saveChanges") : t("publish")}
      preview={<PromoPreview form={form} />}
    >
      {busy ? (
        <p className="text-muted-foreground text-sm">…</p>
      ) : step === "content" ? (
        <div className="space-y-4">
          <Field label={t("fieldName")}>
            <Input
              value={form.name}
              onChange={(e) => {
                set("name", e.target.value);
                if (!slugTouched) set("slug", slugify(e.target.value));
              }}
              placeholder={t("fieldNamePlaceholder")}
              className="h-10"
              autoFocus
            />
          </Field>
          <Field label={t("fieldSlug")}>
            <Input
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", slugify(e.target.value));
              }}
              placeholder="2x1-entre-semana"
              className="h-10"
            />
          </Field>
          <Field label={t("fieldShort")}>
            <Input
              value={form.shortDescription}
              onChange={(e) => set("shortDescription", e.target.value)}
              placeholder={t("fieldShortPlaceholder")}
              className="h-10"
            />
          </Field>
          <Field label={t("fieldLong")} hint={t("optional")}>
            <RichTextEditor
              value={form.longDescription}
              onValueChange={(html) => set("longDescription", html)}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("fieldBadge")} hint={t("optional")}>
              <Input
                value={form.badgeLabel}
                onChange={(e) => set("badgeLabel", e.target.value)}
                placeholder={t("fieldBadgePlaceholder")}
                className="h-10"
              />
            </Field>
            <Field label={t("fieldCategory")} hint={t("optional")}>
              <Input
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder={t("fieldCategoryPlaceholder")}
                className="h-10"
              />
            </Field>
          </div>
          <ToggleRow
            label={t("fieldFeatured")}
            hint={t("featuredHint")}
            checked={form.featured}
            onChange={(v) => set("featured", v)}
          />
        </div>
      ) : step === "design" ? (
        <div className="space-y-4">
          <Field label={t("fieldBg")}>
            <BackgroundPicker
              value={form.backgroundCss}
              onValueChange={(bg) => set("backgroundCss", bg)}
              onUploadImage={uploadImage}
            />
          </Field>
          <Field label={t("fieldMainImage")} hint={t("optional")}>
            <FileUpload
              value={form.mainImageUrl ? [form.mainImageUrl] : []}
              onChange={(urls) => set("mainImageUrl", urls[urls.length - 1] ?? null)}
              accept={{ "image/*": [] }}
              multiple={false}
            />
          </Field>
          <Field label={t("fieldIcon")} hint={t("optional")}>
            <Input
              value={form.icon}
              onChange={(e) => set("icon", e.target.value)}
              placeholder="🎁"
              className="h-10"
            />
          </Field>
        </div>
      ) : step === "benefit" ? (
        <div className="space-y-4">
          <Field label={t("fieldType")}>
            <Select value={form.type} onValueChange={(v) => set("type", (v as PromoType) ?? "percentage")}>
              <SelectTrigger size="lg" className="w-full text-sm">
                <SelectValue>{(v) => t(`type.${v as string}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((ty) => (
                  <SelectItem key={ty} value={ty}>
                    {t(`type.${ty}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {form.type === "percentage" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("fieldPercent")}>
                <NumberInput value={form.percent} onValueChange={(v) => set("percent", v)} suffix=" %" className="h-10" />
              </Field>
              <Field label={t("fieldMaxDiscount")} hint={t("optional")}>
                <NumberInput
                  value={form.maxDiscountUnits}
                  onValueChange={(v) => set("maxDiscountUnits", v)}
                  className="h-10"
                />
              </Field>
            </div>
          ) : form.type === "fixed" ? (
            <Field label={t("fieldAmount")}>
              <NumberInput value={form.amountUnits} onValueChange={(v) => set("amountUnits", v)} className="h-10" />
            </Field>
          ) : form.type === "nForM" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("fieldBuyQty")}>
                <NumberInput value={form.buyQty} onValueChange={(v) => set("buyQty", v)} className="h-10" />
              </Field>
              <Field label={t("fieldPayQty")}>
                <NumberInput value={form.payQty} onValueChange={(v) => set("payQty", v)} className="h-10" />
              </Field>
            </div>
          ) : form.type === "freeItem" ? (
            <Field label={t("fieldFreeItem")}>
              <ProductCombobox
                max={1}
                value={form.freeItemId ? [form.freeItemId] : []}
                onChange={(ids) => set("freeItemId", ids[0] ?? "")}
                placeholder={t("productSearch")}
              />
            </Field>
          ) : (
            <Field label={t("fieldMultiplier")}>
              <NumberInput value={form.multiplier} onValueChange={(v) => set("multiplier", v)} suffix="x" className="h-10" />
            </Field>
          )}

          <Field label={t("fieldScope")} hint={t("scopeHint")}>
            <Select value={form.scopeKind} onValueChange={(v) => set("scopeKind", (v as ScopeKind) ?? "order")}>
              <SelectTrigger size="lg" className="w-full text-sm">
                <SelectValue>{(v) => t(`scope.${v as string}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SCOPES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`scope.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {form.scopeKind === "products" ? (
            <ProductCombobox
              value={form.productIds}
              onChange={(ids) => set("productIds", ids)}
              placeholder={t("productSearch")}
            />
          ) : form.scopeKind === "categories" ? (
            <CategoryPicker selected={form.categoryIds} onChange={(ids) => set("categoryIds", ids)} />
          ) : null}
        </div>
      ) : step === "rules" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label={t("fieldMinPurchase")} hint={t("optional")}>
              <NumberInput
                value={form.minPurchaseUnits}
                onValueChange={(v) => set("minPurchaseUnits", v)}
                className="h-10"
              />
            </Field>
            <Field label={t("fieldMaxUses")} hint={t("optional")}>
              <NumberInput value={form.maxUsesTotal} onValueChange={(v) => set("maxUsesTotal", v)} className="h-10" />
            </Field>
            <Field label={t("fieldMaxPerCustomer")} hint={t("optional")}>
              <NumberInput
                value={form.maxPerCustomer}
                onValueChange={(v) => set("maxPerCustomer", v)}
                className="h-10"
              />
            </Field>
          </div>
          <Field label={t("fieldDays")} hint={t("optional")}>
            <div className="flex flex-wrap gap-2">
              {DAY_KEYS.map((d, idx) => {
                const active = form.daysOfWeek.includes(idx);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      set(
                        "daysOfWeek",
                        active ? form.daysOfWeek.filter((x) => x !== idx) : [...form.daysOfWeek, idx],
                      )
                    }
                    className={
                      active
                        ? "bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-xs font-bold"
                        : "border-border text-muted-foreground rounded-lg border px-3 py-1.5 text-xs font-bold"
                    }
                  >
                    {t(`day.${d}`)}
                  </button>
                );
              })}
            </div>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("hoursFrom")} hint={t("optional")}>
              <HourSelect value={form.hoursFrom} onChange={(v) => set("hoursFrom", v)} />
            </Field>
            <Field label={t("hoursTo")} hint={t("optional")}>
              <HourSelect value={form.hoursTo} onChange={(v) => set("hoursTo", v)} />
            </Field>
          </div>
          <ToggleRow
            label={t("fieldFirstPurchase")}
            hint={t("firstPurchaseHint")}
            checked={form.firstPurchaseOnly}
            onChange={(v) => set("firstPurchaseOnly", v)}
          />

          <div className="border-border space-y-4 rounded-2xl border p-4">
            <Field label={t("fieldAudience")}>
              <Select
                value={form.audienceType}
                onValueChange={(v) => set("audienceType", (v as AudienceType) ?? "all")}
              >
                <SelectTrigger size="lg" className="w-full text-sm">
                  <SelectValue>{(v) => t(`audience.${v as string}`)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("audience.all")}</SelectItem>
                  <SelectItem value="tier">{t("audience.tier")}</SelectItem>
                  <SelectItem value="specific">{t("audience.specific")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {form.audienceType === "tier" ? (
              <Field label={t("tier")}>
                <Select value={form.tierKey} onValueChange={(v) => set("tierKey", (v as TierKey) ?? "oro")}>
                  <SelectTrigger size="lg" className="w-full text-sm">
                    <SelectValue>{(v) => v as string}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TIERS.map((tier) => (
                      <SelectItem key={tier} value={tier}>
                        {tier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : form.audienceType === "specific" ? (
              <CustomerPicker
                selected={form.audienceCustomerIds}
                onChange={(ids) => set("audienceCustomerIds", ids)}
              />
            ) : null}
          </div>

          <ToggleRow
            label={t("fieldStackable")}
            hint={t("stackableHint")}
            checked={form.stackable}
            onChange={(v) => set("stackable", v)}
          />
        </div>
      ) : step === "schedule" ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("start")} hint={t("optional")}>
              <DatePicker
                value={form.startsAt ?? undefined}
                onValueChange={(d) => set("startsAt", d ?? null)}
                placeholder={t("datePlaceholder")}
                formatLabel={(d) => formatDate(d, { locale })}
              />
            </Field>
            <Field label={t("end")} hint={t("optional")}>
              <DatePicker
                value={form.endsAt ?? undefined}
                onValueChange={(d) => set("endsAt", d ?? null)}
                placeholder={t("datePlaceholder")}
                formatLabel={(d) => formatDate(d, { locale })}
              />
            </Field>
          </div>
          {promoId ? <NotificationsPanel promoId={promoId} /> : null}
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">{t("reviewTitle")}</h2>
          <dl className="divide-border divide-y text-sm">
            <ReviewRow label={t("fieldName")} value={form.name || "—"} />
            <ReviewRow label={t("fieldSlug")} value={form.slug || "—"} />
            <ReviewRow label={t("fieldType")} value={t(`type.${form.type}`)} />
            <ReviewRow label={t("fieldScope")} value={t(`scope.${form.scopeKind}`)} />
            <ReviewRow label={t("fieldAudience")} value={t(`audience.${form.audienceType}`)} />
            <ReviewRow label={t("fieldStackable")} value={form.stackable ? t("yes") : t("no")} />
            <ReviewRow
              label={t("start")}
              value={form.startsAt ? formatDate(form.startsAt, { locale }) : "—"}
            />
            <ReviewRow
              label={t("end")}
              value={form.endsAt ? formatDate(form.endsAt, { locale }) : "—"}
            />
          </dl>
        </div>
      )}
    </WizardShell>
  );
}

/** Category multiselect backed by `menu.categories` (value = category slug). */
function CategoryPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const t = useTranslations("Promotions");
  const trpc = useTRPC();
  const { data } = useQuery(trpc.menu.categories.queryOptions());
  const cats = data ?? [];
  const toggle = (slug: string) =>
    onChange(selected.includes(slug) ? selected.filter((x) => x !== slug) : [...selected, slug]);

  return (
    <div className="border-border flex flex-wrap gap-2 rounded-2xl border p-3">
      {cats.length === 0 ? (
        <p className="text-muted-foreground text-xs">{t("noCategories")}</p>
      ) : (
        cats.map((c) => {
          const active = selected.includes(c.slug);
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => toggle(c.slug)}
              className={
                active
                  ? "bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-xs font-bold"
                  : "border-border text-muted-foreground rounded-lg border px-3 py-1.5 text-xs font-bold"
              }
            >
              {c.name}
            </button>
          );
        })
      )}
    </div>
  );
}

/** Customer multiselect backed by `customers.search`. */
function CustomerPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const t = useTranslations("Promotions");
  const trpc = useTRPC();
  const [query, setQuery] = useState("");
  const { data } = useQuery(trpc.customers.search.queryOptions({ query, limit: 10 }));
  const toggle = (cid: string) =>
    onChange(selected.includes(cid) ? selected.filter((x) => x !== cid) : [...selected, cid]);

  return (
    <div>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("searchCustomers")}
        className="h-10"
      />
      <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
        {(data ?? []).map((c) => (
          <label
            key={c.id}
            className="hover:bg-muted/50 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
          >
            <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
            <span className="truncate">{c.name ?? c.phone}</span>
          </label>
        ))}
      </div>
      {selected.length > 0 ? (
        <p className="text-muted-foreground mt-2 text-xs font-semibold">
          {t("selectedCount", { n: selected.length })}
        </p>
      ) : null}
    </div>
  );
}

/** Scheduled-notifications manager for a promo (one-shot or weekly). */
function NotificationsPanel({ promoId }: { promoId: string }) {
  const t = useTranslations("Promotions");
  const locale = useLocale();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const list = useQuery(trpc.promociones.notifications.list.queryOptions({ promoId }));
  const invalidate = () =>
    queryClient.invalidateQueries(trpc.promociones.notifications.list.queryFilter({ promoId }));
  const create = useMutation(
    trpc.promociones.notifications.create.mutationOptions({ onSuccess: () => invalidate() }),
  );
  const cancel = useMutation(
    trpc.promociones.notifications.cancel.mutationOptions({ onSuccess: () => invalidate() }),
  );

  const [audienceType, setAudienceType] = useState<AudienceType>("all");
  const [tierKey, setTierKey] = useState<TierKey>("oro");
  const [channels, setChannels] = useState<string[]>(["push", "database", "realtime"]);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [repeat, setRepeat] = useState<"none" | "weekly">("none");
  const [selected, setSelected] = useState<string[]>([]);

  const toggleChannel = (c: string) =>
    setChannels((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  const onAdd = () => {
    if (channels.length === 0) return toast.error(t("notify.needChannel"));
    if (repeat === "weekly" && !scheduledAt) return toast.error(t("notify.needSchedule"));
    create.mutate(
      {
        promoId,
        audienceType,
        tierKey: audienceType === "tier" ? tierKey : undefined,
        customerIds: audienceType === "specific" ? selected : undefined,
        channels: channels as ("push" | "database" | "realtime")[],
        scheduledAt: scheduledAt ?? undefined,
        repeat,
      },
      {
        onSuccess: () => {
          toast.success(t("notify.added"));
          setSelected([]);
        },
        onError: () => toast.error(t("notify.addError")),
      },
    );
  };

  return (
    <div className="border-border space-y-4 rounded-2xl border p-4">
      <div className="flex items-center gap-2">
        <Bell className="text-muted-foreground size-4" />
        <h3 className="text-sm font-bold">{t("notify.title")}</h3>
      </div>

      {(list.data ?? []).length > 0 ? (
        <ul className="space-y-2">
          {list.data!.map((n) => (
            <li
              key={n.id}
              className="bg-muted/40 flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {n.audienceType === "all"
                    ? t("audience.all")
                    : n.audienceType === "tier"
                      ? `${t("audience.tier")} · ${n.tierKey}`
                      : `${t("audience.specific")} · ${n.customerCount ?? 0}`}
                </p>
                <p className="text-muted-foreground text-xs">
                  {n.channels.join(", ")} ·{" "}
                  {n.scheduledAt ? formatDate(n.scheduledAt, { locale }) : t("notify.now")}
                  {n.repeat === "weekly" ? ` · ${t("notify.weekly")}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{t(`notify.status.${n.status}`)}</Badge>
                {n.status === "scheduled" ? (
                  <Button
                    variant="ghost"
                    className="size-7 rounded-lg p-0"
                    aria-label={t("notify.cancel")}
                    onClick={() => cancel.mutate({ id: n.id })}
                  >
                    <X className="size-4" />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">{t("notify.empty")}</p>
      )}

      <div className="space-y-3 border-t border-dashed pt-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("notify.audience")}>
            <Select value={audienceType} onValueChange={(v) => setAudienceType((v as AudienceType) ?? "all")}>
              <SelectTrigger size="lg" className="w-full text-sm">
                <SelectValue>{(v) => t(`audience.${v as string}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("audience.all")}</SelectItem>
                <SelectItem value="tier">{t("audience.tier")}</SelectItem>
                <SelectItem value="specific">{t("audience.specific")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {audienceType === "tier" ? (
            <Field label={t("tier")}>
              <Select value={tierKey} onValueChange={(v) => setTierKey((v as TierKey) ?? "oro")}>
                <SelectTrigger size="lg" className="w-full text-sm">
                  <SelectValue>{(v) => v as string}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TIERS.map((tier) => (
                    <SelectItem key={tier} value={tier}>
                      {tier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <Field label={t("notify.when")} hint={t("notify.now")}>
            <DatePicker
              value={scheduledAt ?? undefined}
              onValueChange={(d) => setScheduledAt(d ?? null)}
              placeholder={t("notify.now")}
              formatLabel={(d) => formatDate(d, { locale })}
            />
          </Field>
          <Field label={t("notify.repeat")}>
            <Select value={repeat} onValueChange={(v) => setRepeat((v as "none" | "weekly") ?? "none")}>
              <SelectTrigger size="lg" className="w-full text-sm">
                <SelectValue>{(v) => t(`notify.repeat_${v as string}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("notify.repeat_none")}</SelectItem>
                <SelectItem value="weekly">{t("notify.repeat_weekly")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        {audienceType === "specific" ? (
          <CustomerPicker selected={selected} onChange={setSelected} />
        ) : null}

        <Field label={t("notify.channels")}>
          <div className="flex flex-wrap gap-3">
            {CHANNELS.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm font-semibold">
                <Checkbox checked={channels.includes(c)} onCheckedChange={() => toggleChannel(c)} />
                {t(`notify.ch.${c}`)}
              </label>
            ))}
          </div>
        </Field>

        <Button className="h-10 rounded-xl" onClick={onAdd} disabled={create.isPending}>
          {scheduledAt ? t("notify.schedule") : t("notify.sendNow")}
        </Button>
      </div>
    </div>
  );
}

/** Mirrors the customer hub card (apps/web promo-card) so the editor preview is
 *  faithful: full-bleed gradient/cover image + badge + name + short over it. */
function PromoPreview({ form }: { form: Form }) {
  return (
    <div
      className="preview-customer relative h-44 w-full overflow-hidden rounded-3xl shadow-lg shadow-black/10 ring-1 ring-black/5 lg:h-52"
      style={{ background: form.backgroundCss }}
    >
      {form.mainImageUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${form.mainImageUrl})` }}
        />
      ) : null}
      <div
        className={
          form.mainImageUrl
            ? "absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/15"
            : "absolute inset-0 bg-gradient-to-r from-black/35 via-black/10 to-transparent"
        }
      />
      <div className="relative z-10 flex h-full max-w-[72%] flex-col justify-center p-5 text-white">
        {form.badgeLabel ? (
          <span className="mb-2 inline-flex w-fit rounded-full bg-white/25 px-3 py-1 text-xs font-extrabold tracking-wide backdrop-blur-sm">
            {form.badgeLabel}
          </span>
        ) : null}
        <p className="font-display text-xl leading-tight font-semibold drop-shadow-sm">
          {form.name || "—"}
        </p>
        {form.shortDescription ? (
          <p className="mt-1 line-clamp-2 text-sm text-white/85 drop-shadow-sm">
            {form.shortDescription}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="border-border flex items-center justify-between gap-4 rounded-2xl border p-4">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {hint ? <span className="text-muted-foreground/70 text-xs font-semibold">{hint}</span> : null}
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
