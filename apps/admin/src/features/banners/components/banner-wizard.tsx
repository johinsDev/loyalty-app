"use client";

import { formatDate } from "@loyalty/date";
import {
  BackgroundPicker,
  DatePicker,
  IconPicker,
  Input,
  Label,
  RichTextEditor,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@loyalty/ui";
import { ExternalLink, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { WizardShell } from "@/components/wizard-shell";
import { useRouter } from "@/i18n/navigation";

import {
  BANNER_EMOJIS,
  type BannerDraft,
  type BannerType,
  emptyBannerDraft,
  getBannerDraft,
  PROMOS,
} from "../data";
import { BannerPreview } from "./banner-preview";

const STEPS = ["content", "design", "target", "schedule", "review"] as const;
type Step = (typeof STEPS)[number];

/**
 * Banner create/edit wizard (contenido → diseño → destino → programación →
 * revisar) with a live in-app banner preview. Design-first: step state is local;
 * finish toasts + returns to the list. Seam: a banners table + storage channel.
 */
export function BannerWizard({ id }: { id?: string }) {
  const t = useTranslations("Banners");
  const locale = useLocale();
  const router = useRouter();
  const [draft, setDraft] = useState<BannerDraft>(
    id ? getBannerDraft(id) : emptyBannerDraft,
  );
  const [stepIndex, setStepIndex] = useState(0);

  const step = STEPS[stepIndex]!;
  const set = <K extends keyof BannerDraft>(key: K, value: BannerDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const steps = STEPS.map((key) => ({ key, label: t(`step.${key}`) }));
  const completed = STEPS.slice(0, stepIndex);

  const onNext = () => {
    if (stepIndex === STEPS.length - 1) {
      toast.success(
        id ? t("updated", { name: draft.title }) : t("created", { name: draft.title }),
      );
      router.push("/banners");
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
      preview={<BannerPreview draft={draft} />}
    >
      {step === "content" ? (
        <div className="space-y-4">
          <Field label={t("fieldTitle")}>
            <Input
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder={t("fieldTitlePlaceholder")}
              className="h-10"
              autoFocus
            />
          </Field>
          <Field label={t("fieldSubtitle")} hint={t("optional")}>
            <RichTextEditor
              value={draft.subtitle}
              onValueChange={(html) => set("subtitle", html)}
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
      ) : step === "design" ? (
        <div className="space-y-5">
          <Field label={t("fieldGradient")}>
            <BackgroundPicker
              value={draft.bg}
              onValueChange={(bg) => set("bg", bg)}
              customLabel={t("colorMode")}
              uploadLabel={t("imgUpload")}
              removeLabel={t("imgRemove")}
            />
          </Field>
          <Field label={t("fieldIcon")}>
            <IconPicker
              value={draft.emoji}
              onValueChange={(e) => set("emoji", e)}
              emojis={BANNER_EMOJIS}
              customLabel={t("iconCustom")}
              uploadLabel={t("imgUpload")}
              removeLabel={t("imgRemove")}
            />
          </Field>
        </div>
      ) : step === "target" ? (
        <div className="space-y-5">
          <Field label={t("fieldType")} hint={t("typeHint")}>
            <SegmentedControl<BannerType>
              value={draft.type}
              onValueChange={(v) => set("type", v)}
              options={[
                { value: "promo", label: t("type.promo"), icon: Sparkles },
                { value: "standalone", label: t("type.standalone"), icon: ExternalLink },
              ]}
            />
          </Field>
          {draft.type === "promo" ? (
            <Field label={t("fieldPromo")}>
              <Select value={draft.promo} onValueChange={(v) => set("promo", v ?? "")}>
                <SelectTrigger size="lg" className="w-full text-sm">
                  <SelectValue>{(v) => t(`promo.${v as string}`)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PROMOS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`promo.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <p className="bg-muted/40 text-muted-foreground rounded-2xl p-4 text-sm font-semibold">
              {t("standaloneHint")}
            </p>
          )}
        </div>
      ) : step === "schedule" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("fieldStart")}>
            <DatePicker
              value={draft.start ?? undefined}
              onValueChange={(d) => set("start", d ?? null)}
              placeholder={t("datePlaceholder")}
              formatLabel={(d) => formatDate(d, { locale })}
            />
          </Field>
          <Field label={t("fieldEnd")} hint={t("optional")}>
            <DatePicker
              value={draft.end ?? undefined}
              onValueChange={(d) => set("end", d ?? null)}
              placeholder={t("datePlaceholder")}
              formatLabel={(d) => formatDate(d, { locale })}
            />
          </Field>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {t("reviewTitle")}
          </h2>
          <dl className="divide-border divide-y text-sm">
            <ReviewRow label={t("fieldTitle")} value={draft.title || "—"} />
            <ReviewRow label={t("fieldType")} value={t(`type.${draft.type}`)} />
            {draft.type === "promo" ? (
              <ReviewRow label={t("fieldPromo")} value={t(`promo.${draft.promo}`)} />
            ) : null}
            <ReviewRow
              label={t("fieldStart")}
              value={draft.start ? formatDate(draft.start, { locale }) : "—"}
            />
            <ReviewRow
              label={t("fieldEnd")}
              value={draft.end ? formatDate(draft.end, { locale }) : t("noEnd")}
            />
          </dl>
        </div>
      )}
    </WizardShell>
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
