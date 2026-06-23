"use client";

import { formatDate } from "@loyalty/date";
import {
  DatePicker,
  Input,
  Label,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  TimeInput,
} from "@loyalty/ui";
import {
  Bell,
  CalendarClock,
  Mail,
  MessageCircle,
  MessageSquare,
  Repeat,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { WizardShell } from "@/components/wizard-shell";
import { useRouter } from "@/i18n/navigation";

import {
  type CampaignDraft,
  type Channel,
  CHANNELS,
  emptyCampaignDraft,
  EVENTS,
  FREQUENCIES,
  getCampaignDraft,
  type Segment,
  SEGMENTS,
} from "../data";
import { ChannelPreview } from "./channel-preview";

const STEPS = ["content", "channels", "segment", "schedule", "review"] as const;
type Step = (typeof STEPS)[number];
const CHANNEL_ICON: Record<Channel, LucideIcon> = {
  push: Bell,
  email: Mail,
  sms: MessageSquare,
  whatsapp: MessageCircle,
};
const SCHEDULE_ICON = { event: Zap, recurring: Repeat, date: CalendarClock };

/**
 * Campaign create/edit wizard (contenido → canales → segmento → programación →
 * revisar) with a live per-channel preview (the richest CRUD). Design-first:
 * step state is local; finish toasts + returns to the list. Seam: the Phase D
 * notifications engine + Trigger.dev scheduling.
 */
export function CampaignWizard({ id }: { id?: string }) {
  const t = useTranslations("Campaigns");
  const locale = useLocale();
  const router = useRouter();
  const [draft, setDraft] = useState<CampaignDraft>(
    id ? getCampaignDraft(id) : emptyCampaignDraft,
  );
  const [stepIndex, setStepIndex] = useState(0);

  const step = STEPS[stepIndex]!;
  const set = <K extends keyof CampaignDraft>(key: K, value: CampaignDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const toggleChannel = (c: Channel) =>
    set(
      "channels",
      draft.channels.includes(c)
        ? draft.channels.filter((x) => x !== c)
        : [...draft.channels, c],
    );

  const steps = STEPS.map((key) => ({ key, label: t(`step.${key}`) }));
  const completed = STEPS.slice(0, stepIndex);

  const onNext = () => {
    if (stepIndex === STEPS.length - 1) {
      toast.success(
        id ? t("updated", { name: draft.name }) : t("created", { name: draft.name }),
      );
      router.push("/campaigns");
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
      finishLabel={id ? t("saveChanges") : t("launch")}
      preview={
        <div className="space-y-4">
          {draft.channels.length === 0 ? (
            <p className="text-muted-foreground text-sm font-semibold">
              {t("previewEmpty")}
            </p>
          ) : (
            draft.channels.map((c) => (
              <ChannelPreview key={c} channel={c} draft={draft} />
            ))
          )}
        </div>
      }
    >
      {step === "content" ? (
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
          <Field label={t("fieldTitle")}>
            <Input
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder={t("fieldTitlePlaceholder")}
              className="h-10"
            />
          </Field>
          <Field label={t("fieldBody")}>
            <Textarea
              value={draft.body}
              onChange={(e) => set("body", e.target.value)}
              placeholder={t("fieldBodyPlaceholder")}
              rows={4}
              className="min-h-28 rounded-xl"
            />
          </Field>
          <Field label={t("fieldCta")} hint={t("optional")}>
            <Input
              value={draft.cta}
              onChange={(e) => set("cta", e.target.value)}
              placeholder={t("fieldCtaPlaceholder")}
              className="h-10"
            />
          </Field>
        </div>
      ) : step === "channels" ? (
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm font-semibold">
            {t("channelsHint")}
          </p>
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
        </div>
      ) : step === "segment" ? (
        <div className="space-y-4">
          <Field label={t("fieldSegment")} hint={t("segmentHint")}>
            <Select
              value={draft.segment}
              onValueChange={(v) => set("segment", v as Segment)}
            >
              <SelectTrigger size="lg" className="w-full text-sm">
                <SelectValue>{(v) => t(`segment.${v as Segment}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SEGMENTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`segment.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="bg-muted/40 text-muted-foreground rounded-2xl p-4 text-sm font-semibold">
            {t("segmentReach", { n: SEGMENT_REACH[draft.segment] })}
          </div>
        </div>
      ) : step === "schedule" ? (
        <div className="space-y-5">
          <Field label={t("scheduleMode")}>
            <SegmentedControl<CampaignDraft["scheduleMode"]>
              value={draft.scheduleMode}
              onValueChange={(v) => set("scheduleMode", v)}
              options={[
                { value: "event", label: t("modeEvent"), icon: SCHEDULE_ICON.event },
                { value: "recurring", label: t("modeRecurring"), icon: SCHEDULE_ICON.recurring },
                { value: "date", label: t("modeDate"), icon: SCHEDULE_ICON.date },
              ]}
            />
          </Field>

          {draft.scheduleMode === "event" ? (
            <Field label={t("fieldEvent")}>
              <Select
                value={draft.event}
                onValueChange={(v) => set("event", v ?? "")}
              >
                <SelectTrigger size="lg" className="w-full text-sm">
                  <SelectValue>{(v) => t(`event.${v as string}`)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {EVENTS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {t(`event.${e}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : draft.scheduleMode === "recurring" ? (
            <Field label={t("fieldFrequency")}>
              <Select
                value={draft.frequency}
                onValueChange={(v) => set("frequency", v ?? "")}
              >
                <SelectTrigger size="lg" className="w-full text-sm">
                  <SelectValue>{(v) => t(`frequency.${v as string}`)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {t(`frequency.${f}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("fieldDate")}>
                <DatePicker
                  value={draft.date ?? undefined}
                  onValueChange={(d) => set("date", d ?? null)}
                  placeholder={t("datePlaceholder")}
                  formatLabel={(d) => formatDate(d, { locale })}
                />
              </Field>
              <Field label={t("fieldTime")}>
                <TimeInput value={draft.time} onChange={(v) => set("time", v)} />
              </Field>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {t("reviewTitle")}
          </h2>
          <dl className="divide-border divide-y text-sm">
            <ReviewRow label={t("fieldName")} value={draft.name || "—"} />
            <ReviewRow
              label={t("channelsLabel")}
              value={
                draft.channels.length
                  ? draft.channels.map((c) => t(`channel.${c}`)).join(", ")
                  : "—"
              }
            />
            <ReviewRow
              label={t("fieldSegment")}
              value={t(`segment.${draft.segment}`)}
            />
            <ReviewRow
              label={t("scheduleMode")}
              value={
                draft.scheduleMode === "event"
                  ? t(`event.${draft.event}`)
                  : draft.scheduleMode === "recurring"
                    ? t(`frequency.${draft.frequency}`)
                    : draft.date
                      ? `${formatDate(draft.date, { locale })} · ${draft.time}`
                      : t("modeDate")
              }
            />
          </dl>
        </div>
      )}
    </WizardShell>
  );
}

const SEGMENT_REACH: Record<Segment, string> = {
  all: "12,800",
  vip: "1,240",
  atRisk: "860",
  new: "318",
  inactive: "2,100",
};

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
