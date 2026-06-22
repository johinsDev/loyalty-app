"use client";

import {
  Button,
  DateWheelPicker,
  Input,
  InputPhone,
  Label,
  NumberInput,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@loyalty/ui";
import {
  Bell,
  CalendarDays,
  Coins,
  Mail,
  MessageCircle,
  MessageSquare,
  Stamp,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { WizardShell } from "@/components/wizard-shell";
import { useRouter } from "@/i18n/navigation";

import {
  type Channel,
  CHANNELS,
  type CustomerDraft,
  emptyCustomerDraft,
  getCustomerDraft,
  type Tier,
  tierColor,
} from "../data";

const STEPS = ["basics", "loyalty", "preferences", "review"] as const;
type Step = (typeof STEPS)[number];
const TIERS: Tier[] = ["bronze", "silver", "gold", "diamond"];
const CHANNEL_ICON: Record<Channel, LucideIcon> = {
  push: Bell,
  email: Mail,
  sms: MessageSquare,
  whatsapp: MessageCircle,
};

/**
 * Customer create/edit wizard (datos → lealtad → preferencias → revisar) with a
 * live customer-card preview — richer than the old inline modal. Design-first:
 * step state is local; a finish toasts and returns to the list/detail. Seam: the
 * Phase A customer + loyaltyCard + opt-out model.
 */
export function CustomerWizard({ id }: { id?: string }) {
  const t = useTranslations("Customers");
  const locale = useLocale();
  const router = useRouter();
  const [draft, setDraft] = useState<CustomerDraft>(
    id ? getCustomerDraft(id) : emptyCustomerDraft,
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [bdayOpen, setBdayOpen] = useState(false);

  const monthLabels = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        new Intl.DateTimeFormat(locale, { month: "short" }).format(
          new Date(2000, i, 1),
        ),
      ),
    [locale],
  );

  const step = STEPS[stepIndex]!;
  const set = <K extends keyof CustomerDraft>(key: K, value: CustomerDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const toggleChannel = (c: Channel) =>
    set(
      "channels",
      draft.channels.includes(c)
        ? draft.channels.filter((x) => x !== c)
        : [...draft.channels, c],
    );

  const steps = STEPS.map((key) => ({ key, label: t(`wizard.${key}`) }));
  const completed = STEPS.slice(0, stepIndex);

  const onNext = () => {
    if (stepIndex === STEPS.length - 1) {
      toast.success(
        id
          ? t("updated", { name: draft.name })
          : t("created", { name: draft.name }),
      );
      router.push("/customers");
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
      finishLabel={id ? t("saveChanges") : t("create")}
      preview={
        <CustomerPreview draft={draft} monthLabels={monthLabels} t={t} />
      }
    >
      {step === "basics" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("fieldName")}>
              <Input
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder={t("fieldNamePlaceholder")}
                className="h-10"
                autoFocus
              />
            </Field>
            <Field label={t("fieldNickname")} hint={t("optional")}>
              <Input
                value={draft.nickname}
                onChange={(e) => set("nickname", e.target.value)}
                placeholder={t("fieldNicknamePlaceholder")}
                className="h-10"
              />
            </Field>
          </div>
          <Field label={t("fieldPhone")}>
            <InputPhone
              size="sm"
              value={draft.phone}
              onChange={(v) => set("phone", v.e164)}
            />
          </Field>
          <Field label={t("email")} hint={t("optional")}>
            <Input
              type="email"
              value={draft.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="cliente@correo.com"
              className="h-10"
            />
          </Field>
          <Field label={t("birthday")}>
            <button
              type="button"
              onClick={() => setBdayOpen(true)}
              className="border-input bg-input/30 hover:bg-input/50 flex h-10 w-full items-center gap-2.5 rounded-xl border px-4 text-left text-sm transition-colors"
            >
              <CalendarDays className="text-muted-foreground size-4" />
              {draft.birthday.day} {monthLabels[draft.birthday.month - 1]}{" "}
              {draft.birthday.year}
            </button>
          </Field>
        </div>
      ) : step === "loyalty" ? (
        <div className="space-y-4">
          <Field label={t("fieldTier")}>
            <Select
              value={draft.tier}
              onValueChange={(v) => set("tier", v as Tier)}
            >
              <SelectTrigger size="lg" className="w-full text-sm">
                <SelectValue>
                  {(value) => t(`tier.${value as Tier}`)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TIERS.map((tr) => (
                  <SelectItem key={tr} value={tr}>
                    {t(`tier.${tr}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("initialStamps")} hint={t("optional")}>
              <NumberInput
                value={draft.initialStamps}
                onValueChange={(v) => set("initialStamps", v ?? 0)}
                className="h-10"
              />
            </Field>
            <Field label={t("initialPoints")} hint={t("optional")}>
              <NumberInput
                value={draft.initialPoints}
                onValueChange={(v) => set("initialPoints", v ?? 0)}
                className="h-10"
              />
            </Field>
          </div>
        </div>
      ) : step === "preferences" ? (
        <div className="space-y-5">
          <Field label={t("channelsLabel")} hint={t("channelsHint")}>
            <div className="grid grid-cols-2 gap-2">
              {CHANNELS.map((c) => {
                const Icon = CHANNEL_ICON[c];
                const on = draft.channels.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleChannel(c)}
                    className={`flex items-center gap-2.5 rounded-xl border p-3 text-left text-sm font-semibold transition-colors ${
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-4" />
                    {t(`channel.${c}`)}
                  </button>
                );
              })}
            </div>
          </Field>
          <div className="border-border flex items-center justify-between rounded-2xl border p-4">
            <div>
              <div className="font-bold">{t("marketingLabel")}</div>
              <p className="text-muted-foreground/80 mt-0.5 text-xs font-semibold">
                {t("marketingHint")}
              </p>
            </div>
            <Switch
              size="lg"
              checked={draft.marketingOptIn}
              onCheckedChange={(c) => set("marketingOptIn", c)}
            />
          </div>
          <Field label={t("notes")} hint={t("optional")}>
            <Textarea
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder={t("notesPlaceholder")}
              rows={5}
              className="min-h-36 rounded-xl"
            />
          </Field>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {t("reviewTitle")}
          </h2>
          <dl className="divide-border divide-y text-sm">
            <ReviewRow label={t("fieldName")} value={draft.name || "—"} />
            <ReviewRow label={t("fieldPhone")} value={draft.phone || "—"} />
            <ReviewRow label={t("email")} value={draft.email || "—"} />
            <ReviewRow label={t("fieldTier")} value={t(`tier.${draft.tier}`)} />
            <ReviewRow
              label={t("stampsBalance")}
              value={`${draft.initialStamps}`}
            />
            <ReviewRow
              label={t("pointsBalance")}
              value={draft.initialPoints.toLocaleString()}
            />
            <ReviewRow
              label={t("channelsLabel")}
              value={
                draft.channels.length
                  ? draft.channels.map((c) => t(`channel.${c}`)).join(", ")
                  : "—"
              }
            />
          </dl>
        </div>
      )}

      <ResponsiveModal open={bdayOpen} onOpenChange={setBdayOpen}>
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          <div className="px-6 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
              {t("birthday")}
            </ResponsiveModalTitle>
            <ResponsiveModalDescription className="text-muted-foreground mt-1 text-sm">
              {t("birthdayHint")}
            </ResponsiveModalDescription>
            <DateWheelPicker
              className="mt-4"
              value={draft.birthday}
              onValueChange={(v) => set("birthday", v)}
              monthLabels={monthLabels}
              maxYear={new Date().getFullYear()}
            />
            <Button
              onClick={() => setBdayOpen(false)}
              className="mt-4 h-12 w-full rounded-xl font-semibold"
            >
              {t("done")}
            </Button>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </WizardShell>
  );
}

function CustomerPreview({
  draft,
  monthLabels,
  t,
}: {
  draft: CustomerDraft;
  monthLabels: string[];
  t: ReturnType<typeof useTranslations>;
}) {
  const initials =
    draft.name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "T4";
  return (
    <div className="bg-card border-border rounded-3xl border p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="bg-primary/10 text-primary font-display grid size-12 flex-none place-items-center rounded-2xl text-lg font-bold">
          {initials}
        </span>
        <div className="min-w-0">
          <div className="truncate font-bold">
            {draft.name || t("namePlaceholder")}
          </div>
          {draft.nickname ? (
            <div className="text-muted-foreground/70 truncate text-xs font-semibold">
              “{draft.nickname}”
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tierColor[draft.tier]}`}
        >
          {t(`tier.${draft.tier}`)}
        </span>
        <span className="text-primary inline-flex items-center gap-1 text-xs font-bold">
          <Stamp className="size-3" />
          {draft.initialStamps}
        </span>
        <span className="text-primary inline-flex items-center gap-1 text-xs font-bold">
          <Coins className="size-3" />
          {draft.initialPoints.toLocaleString()}
        </span>
      </div>
      <div className="text-muted-foreground/80 mt-3 space-y-1 text-xs font-semibold">
        {draft.phone ? <div>{draft.phone}</div> : null}
        <div>
          {t("birthday")}: {draft.birthday.day}{" "}
          {monthLabels[draft.birthday.month - 1]}
        </div>
      </div>
      {draft.channels.length ? (
        <div className="mt-3 flex gap-1.5">
          {draft.channels.map((c) => {
            const Icon = CHANNEL_ICON[c];
            return (
              <span
                key={c}
                className="bg-muted text-muted-foreground grid size-7 place-items-center rounded-lg"
              >
                <Icon className="size-3.5" />
              </span>
            );
          })}
        </div>
      ) : null}
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
