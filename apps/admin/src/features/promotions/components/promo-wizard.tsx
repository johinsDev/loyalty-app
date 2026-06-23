"use client";

import { formatDate } from "@loyalty/date";
import {
  BackgroundPicker,
  DatePicker,
  Input,
  Label,
  NumberInput,
  RichTextEditor,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  TimeInput,
} from "@loyalty/ui";
import { Gift, Percent, Sparkles, Tag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { WizardShell } from "@/components/wizard-shell";
import { useRouter } from "@/i18n/navigation";

import {
  DAYS,
  emptyPromoDraft,
  getPromoDraft,
  type PromoDraft,
  type PromoType,
  TIERS,
} from "../data";

const STEPS = ["basics", "reward", "conditions", "notify", "review"] as const;
type Step = (typeof STEPS)[number];

/**
 * Promo create/edit wizard (datos → recompensa → condiciones → notificación →
 * revisar) with a live gradient promo-card preview + an estimate panel.
 * Design-first: step state is local; finish toasts + returns to the list. Seam:
 * the Phase D promo engine (wallet/ledger rules) + notifications fan-out.
 */
export function PromoWizard({ id }: { id?: string }) {
  const t = useTranslations("Promotions");
  const locale = useLocale();
  const router = useRouter();
  const [draft, setDraft] = useState<PromoDraft>(
    id ? getPromoDraft(id) : emptyPromoDraft,
  );
  const [stepIndex, setStepIndex] = useState(0);

  const step = STEPS[stepIndex]!;
  const set = <K extends keyof PromoDraft>(key: K, value: PromoDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const toggleDay = (day: string) =>
    set(
      "days",
      draft.days.includes(day)
        ? draft.days.filter((x) => x !== day)
        : [...draft.days, day],
    );

  const steps = STEPS.map((key) => ({ key, label: t(`step.${key}`) }));
  const completed = STEPS.slice(0, stepIndex);

  const onNext = () => {
    if (stepIndex === STEPS.length - 1) {
      toast.success(
        id ? t("updated", { name: draft.name }) : t("created", { name: draft.name }),
      );
      router.push("/promotions");
      return;
    }
    setStepIndex((n) => n + 1);
  };

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
      isLast={stepIndex === STEPS.length - 1}
      finishLabel={id ? t("saveChanges") : t("publish")}
      preview={<PromoPreview draft={draft} t={t} />}
    >
      {step === "basics" ? (
        <div className="space-y-4">
          <Field label={t("fieldName")}>
            <Input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={t("fieldNamePlaceholder")}
              className="h-10"
              autoFocus
            />
          </Field>
          <Field label={t("fieldDesc")}>
            <RichTextEditor
              value={draft.description}
              onValueChange={(html) => set("description", html)}
            />
          </Field>
          <Field label={t("fieldBg")}>
            <BackgroundPicker
              value={draft.bg}
              onValueChange={(bg) => set("bg", bg)}
            />
          </Field>
          <Field label={t("fieldCode")} hint={t("optional")}>
            <Input
              value={draft.code}
              onChange={(e) => set("code", e.target.value)}
              placeholder={t("codePlaceholder")}
              className="h-10"
            />
          </Field>
        </div>
      ) : step === "reward" ? (
        <div className="space-y-5">
          <Field label={t("rewardType")}>
            <SegmentedControl<PromoType>
              value={draft.type}
              onValueChange={(v) => set("type", v)}
              options={[
                { value: "percent", label: t("type.percent"), icon: Percent },
                { value: "fixed", label: t("type.fixed"), icon: Tag },
                { value: "free", label: t("type.free"), icon: Gift },
                { value: "points", label: t("type.points"), icon: Sparkles },
              ]}
            />
          </Field>

          {draft.type === "percent" || draft.type === "fixed" ? (
            <Field label={t("value")}>
              <NumberInput
                value={draft.value}
                onValueChange={(v) => set("value", v ?? 0)}
                className="h-10"
                suffix={draft.type === "percent" ? " %" : undefined}
                prefix={draft.type === "fixed" ? "$ " : undefined}
              />
            </Field>
          ) : draft.type === "free" ? (
            <Field label={t("freeProduct")}>
              <Input
                value={draft.freeProduct}
                onChange={(e) => set("freeProduct", e.target.value)}
                placeholder={t("freeProduct")}
                className="h-10"
              />
            </Field>
          ) : null}
        </div>
      ) : step === "conditions" ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("start")}>
              <DatePicker
                value={draft.start ?? undefined}
                onValueChange={(d) => set("start", d ?? null)}
                placeholder={t("datePlaceholder")}
                formatLabel={(d) => formatDate(d, { locale })}
              />
            </Field>
            <Field label={t("end")}>
              <DatePicker
                value={draft.end ?? undefined}
                onValueChange={(d) => set("end", d ?? null)}
                placeholder={t("datePlaceholder")}
                formatLabel={(d) => formatDate(d, { locale })}
              />
            </Field>
          </div>

          <Field label={t("activeDays")}>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => {
                const on = draft.days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`h-10 rounded-xl border px-3.5 text-sm font-semibold transition-colors ${
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t(`day.${day}`)}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label={t("hours")} hint={t("optional")}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("hoursFrom")}</Label>
                <TimeInput
                  value={draft.hoursFrom}
                  onChange={(v) => set("hoursFrom", v)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("hoursTo")}</Label>
                <TimeInput
                  value={draft.hoursTo}
                  onChange={(v) => set("hoursTo", v)}
                />
              </div>
            </div>
          </Field>

          <Field label={t("tier")}>
            <Select
              value={draft.tier}
              onValueChange={(v) => set("tier", v ?? "")}
            >
              <SelectTrigger size="lg" className="w-full text-sm">
                <SelectValue>
                  {(v) =>
                    v === "all" ? t("allTiers") : t(`tierOpt.${v as string}`)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allTiers")}</SelectItem>
                {TIERS.map((tier) => (
                  <SelectItem key={tier} value={tier}>
                    {t(`tierOpt.${tier}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      ) : step === "notify" ? (
        <div className="space-y-4">
          <div className="border-border flex items-center justify-between gap-4 rounded-2xl border p-4">
            <div className="space-y-0.5">
              <Label className="text-sm">{t("notifyToggle")}</Label>
              <p className="text-muted-foreground text-xs font-semibold">
                {t("notifyHint")}
              </p>
            </div>
            <Switch
              checked={draft.notify}
              onCheckedChange={(c) => set("notify", c)}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {t("reviewTitle")}
          </h2>
          <dl className="divide-border divide-y text-sm">
            <ReviewRow label={t("fieldName")} value={draft.name || "—"} />
            <ReviewRow label={t("rewardType")} value={t(`type.${draft.type}`)} />
            <ReviewRow label={t("value")} value={rewardSummary(draft, t)} />
            <ReviewRow
              label={t("activeDays")}
              value={
                draft.days.length
                  ? draft.days.map((d) => t(`day.${d}`)).join(", ")
                  : "—"
              }
            />
            <ReviewRow
              label={t("tier")}
              value={
                draft.tier === "all"
                  ? t("allTiers")
                  : t(`tierOpt.${draft.tier}`)
              }
            />
            <ReviewRow
              label={t("start")}
              value={draft.start ? formatDate(draft.start, { locale }) : "—"}
            />
          </dl>
        </div>
      )}
    </WizardShell>
  );
}

/** One-line human summary of the reward, reused in the preview card + review. */
function rewardSummary(
  draft: PromoDraft,
  t: ReturnType<typeof useTranslations>,
): string {
  if (draft.type === "percent") return `${draft.value}% OFF`;
  if (draft.type === "fixed") return `$${draft.value} OFF`;
  if (draft.type === "free") return draft.freeProduct || t("freeProduct");
  return "2× puntos";
}

function PromoPreview({
  draft,
  t,
}: {
  draft: PromoDraft;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="space-y-3">
      <div
        className="rounded-3xl p-5 text-white shadow-sm"
        style={{ background: draft.bg }}
      >
        <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase opacity-80">
          <Tag className="size-3.5" />
          {t("previewTitle")}
        </div>
        <div className="font-display mt-3 text-xl font-semibold tracking-tight">
          {draft.name || t("previewNamePlaceholder")}
        </div>
        <div className="mt-1 text-2xl font-extrabold">
          {rewardSummary(draft, t)}
        </div>
        {draft.code ? (
          <div className="mt-3 inline-flex rounded-lg bg-white/15 px-2.5 py-1 text-xs font-bold tracking-wide">
            {draft.code}
          </div>
        ) : null}
      </div>

      <div className="bg-card border-border grid grid-cols-2 gap-3 rounded-2xl border p-4 shadow-sm">
        <div>
          <div className="text-muted-foreground/70 text-xs font-bold tracking-wider uppercase">
            {t("estReach")}
          </div>
          <div className="font-display mt-0.5 text-lg font-semibold tracking-tight">
            {t("reachValue", { n: 1240 })}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground/70 text-xs font-bold tracking-wider uppercase">
            {t("estRevenue")}
          </div>
          <div className="font-display mt-0.5 text-lg font-semibold tracking-tight">
            $3.2K
          </div>
        </div>
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
