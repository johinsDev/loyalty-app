"use client";

import type { BenefitConfig } from "@loyalty/api/features/promotions/rule-compile";
import { benefitConfigSchema, compileRule, decompileRule } from "@loyalty/api/features/promotions/rule-compile";
import { benefitSummary } from "@loyalty/api/features/promotions/format";
import type { MessageContentInput } from "@loyalty/api/features/campaigns/schemas";
import type { PromoType } from "@loyalty/api/features/promotions/schemas";
import { formatDate } from "@loyalty/date";
import {
  BackgroundPicker,
  Button,
  Checkbox,
  DatePicker,
  Input,
  Label,
  NumberInput,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  RichTextEditor,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { WizardShell } from "@/components/wizard-shell";
import {
  AnnounceComposer,
  type AnnounceValue,
} from "@/features/campaigns/components/announce-composer";
import { buildAudienceFilter } from "@/features/campaigns/lib/campaign-audience";
import {
  buildMessageInput,
  isMessageComplete,
  type Channel,
} from "@/features/campaigns/lib/campaign-message";
import { FileUpload } from "@/features/storage/components/file-upload";
import { StoreAvailabilityField } from "@/features/stores/components/store-availability-field";
import { useUploadImage } from "@/features/storage/hooks/use-upload-image";
import { useRouter } from "@/i18n/nav";
import { useNavigationGuard } from "@/lib/use-unsaved-guard";
import { useStoreScope } from "@/lib/store-scope";
import { useTRPC } from "@/lib/trpc/client";

import { promoAnnounceInitial, promoLinkUrl } from "../lib/promo-announce";
import { BenefitConfigFields, defaultConfigFor } from "./benefit-forms";
import { HourSelect } from "./hour-select";

const STEPS = ["essence", "benefit", "conditions", "design", "broadcast", "review"] as const;
type Step = (typeof STEPS)[number];

const TYPES: PromoType[] = [
  "percentOff",
  "amountOff",
  "nxm",
  "secondUnit",
  "bundle",
  "combo",
  "crossSell",
  "cartThreshold",
  "volumeTiered",
  "pointsMultiplier",
];
const TIERS = ["hoja", "flor", "oro"] as const;
type TierKey = (typeof TIERS)[number];
type AudienceType = "all" | "tier" | "specific";
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
type RecurrenceMode = "always" | "weekly" | "monthlyDay" | "monthlyNthWeekday" | "dates";

const centsToUnits = (c: number | null | undefined): number | undefined =>
  c == null ? undefined : Math.round(c) / 100;
const unitsToCents = (u: number | undefined): number | undefined =>
  u == null ? undefined : Math.round(u * 100);

const pad = (n: number) => String(n).padStart(2, "0");
const toDateKey = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

type Form = {
  name: string;
  type: PromoType;
  config: BenefitConfig;
  // conditions
  minPurchaseUnits?: number;
  maxUsesTotal?: number;
  maxPerCustomer?: number;
  purchaseCountMin?: number;
  purchaseCountMax?: number;
  lastPurchaseOlderThanDays?: number;
  audienceType: AudienceType;
  tierKey: TierKey;
  audienceCustomerIds: string[];
  storeIds: string[] | null;
  startsAt: Date | null;
  endsAt: Date | null;
  // schedule
  recurrenceMode: RecurrenceMode;
  weeklyDays: number[];
  monthlyDay?: number;
  nth: 1 | 2 | 3 | 4 | -1;
  nthWeekday: number;
  dates: string[];
  hoursFrom: string;
  hoursTo: string;
  // design
  backgroundCss: string;
  mainImageUrl: string | null;
  badgeLabel: string;
  icon: string;
  shortDescription: string;
  longDescription: string;
  category: string;
  featured: boolean;
};

const EMPTY: Form = {
  name: "",
  type: "percentOff",
  config: defaultConfigFor("percentOff"),
  audienceType: "all",
  tierKey: "oro",
  audienceCustomerIds: [],
  storeIds: null,
  startsAt: null,
  endsAt: null,
  recurrenceMode: "always",
  weeklyDays: [],
  nth: 1,
  nthWeekday: 1,
  dates: [],
  hoursFrom: "",
  hoursTo: "",
  backgroundCss: "linear-gradient(135deg, #1BAD9D, #0e6f64)",
  mainImageUrl: null,
  badgeLabel: "",
  icon: "",
  shortDescription: "",
  longDescription: "",
  category: "",
  featured: false,
};

/**
 * Server-driven promo wizard (essence → benefit → conditions → design →
 * broadcast → review). The draft already exists (the gallery creates it); each
 * Next persists via `advance`, Finish publishes and — when the broadcast toggle
 * is on — fires `campaigns.createFromEntity` best-effort (banner pattern).
 * Broadcast is intentionally a client-only step.
 */
export function PromoWizard({ id }: { id: string }) {
  const t = useTranslations("Promotions");
  const tc = useTranslations("Campaigns.announce");
  const locale = useLocale();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const uploadImage = useUploadImage();
  const { storeId } = useStoreScope();

  const [form, setForm] = useState<Form>(EMPTY);
  const [announce, setAnnounce] = useState<AnnounceValue | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const seeded = useRef(false);
  const finishing = useRef(false);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const bypass = useNavigationGuard(dirty, (href) => {
    setPendingHref(href);
    setExitOpen(true);
  });
  const confirmLeave = () => {
    bypass.current = true;
    setDirty(false);
    setExitOpen(false);
    if (pendingHref && pendingHref !== "__back__") window.location.href = pendingHref;
    else router.push("/promotions");
  };
  const tryExit = () => {
    if (dirty) {
      setPendingHref(null);
      setExitOpen(true);
    } else {
      router.push("/promotions");
    }
  };

  const stateQuery = useQuery(trpc.promociones.getState.queryOptions({ id }));
  const promo = stateQuery.data?.promo;

  // Seed once from the draft, then resume at the server-derived current step.
  useEffect(() => {
    if (!stateQuery.data || seeded.current) return;
    const p = stateQuery.data.promo;
    const type = (TYPES as string[]).includes(p.type ?? "") ? (p.type as PromoType) : "percentOff";
    const config =
      (p.rule ? decompileRule(type, p.rule) : null) ?? defaultConfigFor(type);
    const c = p.conditions ?? {};
    const sched = p.schedule ?? {};
    const rec = sched.recurrence;
    setForm({
      ...EMPTY,
      name: p.name ?? "",
      type,
      config,
      minPurchaseUnits: centsToUnits(c.minPurchaseCents),
      maxUsesTotal: c.maxUsesTotal,
      maxPerCustomer: c.maxPerCustomer,
      purchaseCountMin: c.purchaseCount?.min,
      purchaseCountMax: c.purchaseCount?.max,
      lastPurchaseOlderThanDays: c.lastPurchaseOlderThanDays,
      audienceType: (p.audienceType as AudienceType) ?? "all",
      tierKey: (p.tierKey as TierKey) ?? "oro",
      audienceCustomerIds: p.audienceCustomerIds ?? [],
      // Edit: keep the promo's stored scope. Fresh draft: default to the active store.
      storeIds: p.storeIds ?? (storeId ? [storeId] : null),
      startsAt: p.startsAt,
      endsAt: p.endsAt,
      recurrenceMode: rec?.kind ?? "always",
      weeklyDays: rec?.kind === "weekly" ? rec.days : [],
      monthlyDay: rec?.kind === "monthlyDay" ? rec.day : undefined,
      nth: rec?.kind === "monthlyNthWeekday" ? rec.nth : 1,
      nthWeekday: rec?.kind === "monthlyNthWeekday" ? rec.weekday : 1,
      dates: rec?.kind === "dates" ? rec.dates : [],
      hoursFrom: sched.timeWindow?.from ?? "",
      hoursTo: sched.timeWindow?.to ?? "",
      backgroundCss: p.backgroundCss ?? EMPTY.backgroundCss,
      mainImageUrl: p.mainImageUrl,
      badgeLabel: p.badgeLabel ?? "",
      icon: p.icon ?? "",
      shortDescription: p.shortDescription ?? "",
      longDescription: p.longDescription ?? "",
      category: p.category ?? "",
      featured: p.featured ?? false,
    });
    seeded.current = true;
    const current = stateQuery.data.state.current;
    const idx = (STEPS as readonly string[]).indexOf(current);
    setStepIndex(current === "review" ? STEPS.indexOf("review") : idx >= 0 ? idx : 0);
  }, [stateQuery.data]);

  const advanceMut = useMutation(trpc.promociones.advance.mutationOptions());
  const publishMut = useMutation(trpc.promociones.publish.mutationOptions());
  const createFromEntityMut = useMutation(trpc.campaigns.createFromEntity.mutationOptions());

  const priorCampaignsQuery = useQuery(
    trpc.campaigns.campaignsBySource.queryOptions({ scope: "promo", id }),
  );

  const step = STEPS[stepIndex]!;
  const steps = STEPS.map((key) => ({ key, label: t(`step.${key}`) }));

  // Seed the announcement the first time the admin reaches Difusión.
  useEffect(() => {
    if (step === "broadcast" && announce === null && promo) {
      setAnnounce(
        promoAnnounceInitial({
          slug: promo.slug ?? "",
          name: form.name || (promo.name ?? ""),
          shortDescription: form.shortDescription,
          benefitSummary: liveSummary(),
          startsAt: form.startsAt,
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, announce, promo]);

  const configValid = benefitConfigSchema.safeParse(form.config).success;
  const valid: Record<Step, boolean> = {
    essence: form.name.trim().length > 0,
    benefit: configValid,
    conditions: true,
    design: form.backgroundCss.trim().length > 0,
    broadcast: announce === null || !announce.enabled || isMessageComplete(announce.message),
    review: true,
  };
  const navigable: string[] = [];
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS.slice(0, i).every((s) => valid[s])) navigable.push(STEPS[i]!);
  }
  const completed = STEPS.slice(0, stepIndex).filter((s) => valid[s]);

  function liveSummary(): string | null {
    if (!configValid) return null;
    try {
      return benefitSummary(form.type, compileRule(form.config), locale === "en" ? "en" : "es");
    } catch {
      return null;
    }
  }

  function buildSchedule() {
    const recurrence =
      form.recurrenceMode === "weekly" && form.weeklyDays.length > 0
        ? { kind: "weekly" as const, days: [...form.weeklyDays].sort() }
        : form.recurrenceMode === "monthlyDay" && form.monthlyDay
          ? { kind: "monthlyDay" as const, day: form.monthlyDay }
          : form.recurrenceMode === "monthlyNthWeekday"
            ? { kind: "monthlyNthWeekday" as const, nth: form.nth, weekday: form.nthWeekday }
            : form.recurrenceMode === "dates" && form.dates.length > 0
              ? { kind: "dates" as const, dates: form.dates }
              : undefined;
    const timeWindow =
      /^\d{2}:\d{2}$/.test(form.hoursFrom) && /^\d{2}:\d{2}$/.test(form.hoursTo)
        ? { from: form.hoursFrom, to: form.hoursTo }
        : undefined;
    if (!recurrence && !timeWindow) return null;
    return { ...(recurrence ? { recurrence } : {}), ...(timeWindow ? { timeWindow } : {}) };
  }

  async function persistStep(): Promise<boolean> {
    try {
      if (step === "essence") {
        const res = await advanceMut.mutateAsync({
          id,
          step: "essence",
          input: { name: form.name, type: form.type },
        });
        // A type change resets the rule server-side; mirror it locally.
        if (res.promo.rule === null && form.config.type !== form.type) {
          setForm((f) => ({ ...f, config: defaultConfigFor(f.type) }));
        }
      } else if (step === "benefit") {
        await advanceMut.mutateAsync({ id, step: "benefit", input: form.config });
      } else if (step === "conditions") {
        const conditions = {
          ...(unitsToCents(form.minPurchaseUnits)
            ? { minPurchaseCents: unitsToCents(form.minPurchaseUnits) }
            : {}),
          ...(form.maxUsesTotal ? { maxUsesTotal: form.maxUsesTotal } : {}),
          ...(form.maxPerCustomer ? { maxPerCustomer: form.maxPerCustomer } : {}),
          ...(form.lastPurchaseOlderThanDays
            ? { lastPurchaseOlderThanDays: form.lastPurchaseOlderThanDays }
            : {}),
          ...(form.purchaseCountMin != null || form.purchaseCountMax != null
            ? {
                purchaseCount: {
                  ...(form.purchaseCountMin != null ? { min: form.purchaseCountMin } : {}),
                  ...(form.purchaseCountMax != null ? { max: form.purchaseCountMax } : {}),
                },
              }
            : {}),
        };
        await advanceMut.mutateAsync({
          id,
          step: "conditions",
          input: {
            conditions,
            audienceType: form.audienceType,
            ...(form.audienceType === "tier" ? { tierKey: form.tierKey } : {}),
            ...(form.audienceType === "specific"
              ? { audienceCustomerIds: form.audienceCustomerIds }
              : {}),
            storeIds: form.storeIds,
            startsAt: form.startsAt,
            endsAt: form.endsAt,
            schedule: buildSchedule(),
          },
        });
      } else if (step === "design") {
        await advanceMut.mutateAsync({
          id,
          step: "design",
          input: {
            backgroundCss: form.backgroundCss,
            mainImageUrl: form.mainImageUrl ?? "",
            badgeLabel: form.badgeLabel || null,
            icon: form.icon || null,
            shortDescription: form.shortDescription || null,
            longDescription: form.longDescription || null,
            category: form.category || null,
            featured: form.featured,
          },
        });
      }
      await queryClient.invalidateQueries(trpc.promociones.getState.queryFilter({ id }));
      return true;
    } catch {
      toast.error(t("saveError"));
      return false;
    }
  }

  async function goTo(targetIndex: number) {
    if (targetIndex === stepIndex) return;
    setAttempted(false);
    const isServerStep = stepIndex < 4;
    if (isServerStep && valid[step] && !(await persistStep())) return;
    setStepIndex(targetIndex);
  }

  async function onNext() {
    if (!valid[step]) {
      setAttempted(true);
      return;
    }
    if (step === "review") {
      if (finishing.current) return;
      finishing.current = true;
      try {
        await publishMut.mutateAsync({ id });
      } catch {
        toast.error(t("publishError"));
        finishing.current = false;
        return;
      }
      bypass.current = true;
      setDirty(false);
      await queryClient.invalidateQueries(trpc.promociones.adminList.queryFilter());
      let announced = false;
      if (announce?.enabled) {
        announced = true;
        const channelPriority: Channel[] = announce.message.channelPriority.length
          ? announce.message.channelPriority
          : ["push"];
        try {
          await createFromEntityMut.mutateAsync({
            source: { scope: "promo", id },
            name: form.name,
            message: {
              ...(buildMessageInput(announce.message.message) as MessageContentInput),
              linkUrl: promoLinkUrl({ slug: promo?.slug ?? "", name: form.name }),
            },
            channelPriority,
            audienceFilter: buildAudienceFilter(announce.audience),
            scheduledAt: announce.scheduledAt,
          });
          toast.success(tc("launched"));
        } catch {
          toast.error(tc("failed"));
        }
      }
      if (!announced) toast.success(t("created", { name: form.name }));
      router.push("/promotions");
      return;
    }
    const isServerStep = stepIndex < 4;
    if (!isServerStep || (await persistStep())) {
      setAttempted(false);
      setStepIndex((n) => n + 1);
    }
  }

  const saving =
    advanceMut.isPending || publishMut.isPending || createFromEntityMut.isPending;

  const summary = liveSummary();

  return (
    <>
      <WizardShell
        title={t("newTitle")}
        steps={steps}
        current={step}
        completed={completed}
        navigable={navigable}
        onStepSelect={(key) => {
          if (!saving) void goTo(STEPS.indexOf(key as Step));
        }}
        onBack={() => goTo(Math.max(0, stepIndex - 1))}
        onNext={onNext}
        isFirst={stepIndex === 0}
        isLast={step === "review"}
        finishLabel={t("publish")}
        saving={saving}
        onExit={tryExit}
        exitLabel={t("title")}
        preview={
          <PromoPreview
            name={form.name}
            badge={form.badgeLabel || summary || ""}
            short={form.shortDescription || summary || ""}
            backgroundCss={form.backgroundCss}
            mainImageUrl={form.mainImageUrl}
          />
        }
      >
        {!seeded.current ? (
          <p className="text-muted-foreground text-sm">…</p>
        ) : step === "essence" ? (
          <div className="space-y-4">
            <Field label={t("fieldName")}>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder={t("fieldNamePlaceholder")}
                className="h-10"
                aria-invalid={attempted && !form.name.trim() ? true : undefined}
                autoFocus
              />
            </Field>
            <Field label={t("fieldType")} hint={t("typeHint")}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {TYPES.map((ty) => (
                  <button
                    key={ty}
                    type="button"
                    onClick={() => {
                      set("type", ty);
                      if (form.config.type !== ty) set("config", defaultConfigFor(ty));
                    }}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      form.type === ty
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <p className="text-sm font-semibold">{t(`types.${ty}`)}</p>
                    <p className="text-muted-foreground text-xs">{t(`typeHints.${ty}`)}</p>
                  </button>
                ))}
              </div>
            </Field>
          </div>
        ) : step === "benefit" ? (
          <div className="space-y-4">
            <BenefitConfigFields value={form.config} onChange={(config) => set("config", config)} />
            {summary ? (
              <div className="border-primary/20 bg-primary/5 flex items-center gap-2.5 rounded-2xl border px-4 py-3">
                <Sparkles className="text-primary size-4 shrink-0" />
                <div>
                  <p className="text-primary/70 text-[10px] font-extrabold tracking-wider uppercase">
                    {t("summaryLabel")}
                  </p>
                  <p className="text-sm font-semibold">{summary}</p>
                </div>
              </div>
            ) : null}
          </div>
        ) : step === "conditions" ? (
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
                <NumberInput
                  value={form.maxUsesTotal}
                  onValueChange={(v) => set("maxUsesTotal", v)}
                  className="h-10"
                />
              </Field>
              <Field label={t("fieldMaxPerCustomer")} hint={t("optional")}>
                <NumberInput
                  value={form.maxPerCustomer}
                  onValueChange={(v) => set("maxPerCustomer", v)}
                  className="h-10"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label={t("fieldPurchaseCountMin")} hint={t("optional")}>
                <NumberInput
                  value={form.purchaseCountMin}
                  onValueChange={(v) => set("purchaseCountMin", v)}
                  className="h-10"
                />
              </Field>
              <Field label={t("fieldPurchaseCountMax")} hint={t("purchaseCountMaxHint")}>
                <NumberInput
                  value={form.purchaseCountMax}
                  onValueChange={(v) => set("purchaseCountMax", v)}
                  className="h-10"
                />
              </Field>
              <Field label={t("fieldRecency")} hint={t("recencyHint")}>
                <NumberInput
                  value={form.lastPurchaseOlderThanDays}
                  onValueChange={(v) => set("lastPurchaseOlderThanDays", v)}
                  className="h-10"
                />
              </Field>
            </div>

            <div className="border-border space-y-4 rounded-2xl border p-4">
              <Field label={t("fieldAudience")}>
                <Select
                  value={form.audienceType}
                  onValueChange={(v) => set("audienceType", (v as AudienceType) ?? "all")}
                >
                  <SelectTrigger className="h-10 w-full text-sm">
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
                  <Select
                    value={form.tierKey}
                    onValueChange={(v) => set("tierKey", (v as TierKey) ?? "oro")}
                  >
                    <SelectTrigger className="h-10 w-full text-sm">
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

            <StoreAvailabilityField
              value={form.storeIds}
              onChange={(v) => set("storeIds", v)}
            />

            <div className="border-border space-y-4 rounded-2xl border p-4">
              <p className="text-sm font-semibold">{t("scheduleTitle")}</p>
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

              <Field label={t("recurrence")} hint={t("recurrenceHint")}>
                <Select
                  value={form.recurrenceMode}
                  onValueChange={(v) => set("recurrenceMode", (v as RecurrenceMode) ?? "always")}
                >
                  <SelectTrigger className="h-10 w-full text-sm">
                    <SelectValue>{(v) => t(`recurrenceMode.${v as string}`)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(["always", "weekly", "monthlyDay", "monthlyNthWeekday", "dates"] as const).map(
                      (m) => (
                        <SelectItem key={m} value={m}>
                          {t(`recurrenceMode.${m}`)}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </Field>

              {form.recurrenceMode === "weekly" ? (
                <div className="flex flex-wrap gap-2">
                  {DAY_KEYS.map((d, idx) => {
                    const active = form.weeklyDays.includes(idx);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() =>
                          set(
                            "weeklyDays",
                            active
                              ? form.weeklyDays.filter((x) => x !== idx)
                              : [...form.weeklyDays, idx],
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
              ) : form.recurrenceMode === "monthlyDay" ? (
                <Field label={t("monthlyDayLabel")}>
                  <NumberInput
                    value={form.monthlyDay}
                    onValueChange={(v) => set("monthlyDay", v)}
                    className="h-10 w-24"
                  />
                </Field>
              ) : form.recurrenceMode === "monthlyNthWeekday" ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("nthLabel")}>
                    <Select
                      value={String(form.nth)}
                      onValueChange={(v) => set("nth", Number(v) as Form["nth"])}
                    >
                      <SelectTrigger className="h-10 w-full text-sm">
                        <SelectValue>{(v) => t(`nth.${v as string}`)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {["1", "2", "3", "4", "-1"].map((n) => (
                          <SelectItem key={n} value={n}>
                            {t(`nth.${n}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t("weekdayLabel")}>
                    <Select
                      value={String(form.nthWeekday)}
                      onValueChange={(v) => set("nthWeekday", Number(v))}
                    >
                      <SelectTrigger className="h-10 w-full text-sm">
                        <SelectValue>
                          {(v) => t(`day.${DAY_KEYS[Number(v)] ?? "mon"}`)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {DAY_KEYS.map((d, idx) => (
                          <SelectItem key={d} value={String(idx)}>
                            {t(`day.${d}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              ) : form.recurrenceMode === "dates" ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {form.dates.map((d) => (
                      <span
                        key={d}
                        className="bg-muted inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold"
                      >
                        {d}
                        <button
                          type="button"
                          aria-label={t("removeDate")}
                          onClick={() => set("dates", form.dates.filter((x) => x !== d))}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <DatePicker
                    value={undefined}
                    onValueChange={(d) => {
                      if (!d) return;
                      const key = toDateKey(d);
                      if (!form.dates.includes(key)) set("dates", [...form.dates, key].sort());
                    }}
                    placeholder={t("addDate")}
                    formatLabel={(d) => formatDate(d, { locale })}
                  />
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t("hoursFrom")} hint={t("optional")}>
                  <HourSelect value={form.hoursFrom} onChange={(v) => set("hoursFrom", v)} />
                </Field>
                <Field label={t("hoursTo")} hint={t("optional")}>
                  <HourSelect value={form.hoursTo} onChange={(v) => set("hoursTo", v)} />
                </Field>
              </div>
            </div>
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("fieldBadge")} hint={t("badgeHint")}>
                <Input
                  value={form.badgeLabel}
                  onChange={(e) => set("badgeLabel", e.target.value)}
                  placeholder={summary ?? t("fieldBadgePlaceholder")}
                  className="h-10"
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
            <Field label={t("fieldShort")} hint={t("shortHint")}>
              <Input
                value={form.shortDescription}
                onChange={(e) => set("shortDescription", e.target.value)}
                placeholder={summary ?? t("fieldShortPlaceholder")}
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
              <Field label={t("fieldCategory")} hint={t("optional")}>
                <Input
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  placeholder={t("fieldCategoryPlaceholder")}
                  className="h-10"
                />
              </Field>
              <div className="border-border flex items-center justify-between gap-4 rounded-2xl border p-4">
                <div>
                  <p className="text-sm font-semibold">{t("fieldFeatured")}</p>
                  <p className="text-muted-foreground text-xs">{t("featuredHint")}</p>
                </div>
                <Switch checked={form.featured} onCheckedChange={(v) => set("featured", v)} />
              </div>
            </div>
          </div>
        ) : step === "broadcast" ? (
          announce ? (
            <AnnounceComposer
              value={announce}
              onChange={(v) => {
                setAnnounce(v);
                setDirty(true);
              }}
              priorCampaigns={priorCampaignsQuery.data ?? []}
              showError={attempted}
            />
          ) : (
            <p className="text-muted-foreground text-sm">…</p>
          )
        ) : (
          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              {t("reviewTitle")}
            </h2>
            <dl className="divide-border divide-y text-sm">
              <ReviewRow label={t("fieldName")} value={form.name || "—"} />
              <ReviewRow label={t("fieldType")} value={t(`types.${form.type}`)} />
              <ReviewRow label={t("reviewBenefit")} value={summary ?? "—"} />
              <ReviewRow label={t("fieldAudience")} value={t(`audience.${form.audienceType}`)} />
              <ReviewRow
                label={t("recurrence")}
                value={t(`recurrenceMode.${form.recurrenceMode}`)}
              />
              <ReviewRow
                label={t("start")}
                value={form.startsAt ? formatDate(form.startsAt, { locale }) : "—"}
              />
              <ReviewRow
                label={t("end")}
                value={form.endsAt ? formatDate(form.endsAt, { locale }) : "—"}
              />
              <ReviewRow
                label={t("reviewBroadcast")}
                value={announce?.enabled ? t("yes") : t("no")}
              />
            </dl>
          </div>
        )}
      </WizardShell>

      <ResponsiveModal open={exitOpen} onOpenChange={setExitOpen}>
        <ResponsiveModalContent>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{t("unsavedTitle")}</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <p className="text-muted-foreground px-4 pb-2 text-sm">{t("unsavedHint")}</p>
          <ResponsiveModalFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full px-5"
              onClick={() => setExitOpen(false)}
            >
              {t("stay")}
            </Button>
            <Button
              type="button"
              className="h-10 rounded-full px-6 font-semibold"
              onClick={confirmLeave}
            >
              {t("leave")}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
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

/** Mirrors the customer hub card (apps/web promo-card) so the editor preview is
 *  faithful: full-bleed gradient/cover image + badge + name + short over it. */
export function PromoPreview({
  name,
  badge,
  short,
  backgroundCss,
  mainImageUrl,
}: {
  name: string;
  badge: string;
  short: string;
  backgroundCss: string;
  mainImageUrl: string | null;
}) {
  return (
    <div
      className="preview-customer relative h-44 w-full overflow-hidden rounded-3xl shadow-lg shadow-black/10 ring-1 ring-black/5 lg:h-52"
      style={{ background: backgroundCss }}
    >
      {mainImageUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${mainImageUrl})` }}
        />
      ) : null}
      <div
        className={
          mainImageUrl
            ? "absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/15"
            : "absolute inset-0 bg-gradient-to-r from-black/35 via-black/10 to-transparent"
        }
      />
      <div className="relative z-10 flex h-full max-w-[72%] flex-col justify-center p-5 text-white">
        {badge ? (
          <span className="mb-2 inline-flex w-fit rounded-full bg-white/25 px-3 py-1 text-xs font-extrabold tracking-wide backdrop-blur-sm">
            {badge}
          </span>
        ) : null}
        <p className="font-display text-xl leading-tight font-semibold drop-shadow-sm">
          {name || "—"}
        </p>
        {short ? (
          <p className="mt-1 line-clamp-2 text-sm text-white/85 drop-shadow-sm">{short}</p>
        ) : null}
      </div>
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
