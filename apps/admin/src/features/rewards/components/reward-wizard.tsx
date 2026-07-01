"use client";

import {
  BackgroundPicker,
  IconGlyph,
  IconPicker,
  Input,
  Label,
  RichTextEditor,
  SegmentedControl,
} from "@loyalty/ui";
import { Coins, Stamp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { WizardShell } from "@/components/wizard-shell";
import { useUploadImage } from "@/features/storage/hooks/use-upload-image";
import { useRouter } from "@/i18n/navigation";

import {
  type CostType,
  emptyRewardDraft,
  getRewardDraft,
  REWARD_EMOJIS,
  type RewardDraft,
} from "../data";

const STEPS = ["basics", "cost", "review"] as const;
type Step = (typeof STEPS)[number];

/**
 * Reward create/edit wizard (datos → costo en sellos/puntos → revisar) with a
 * live customer-facing reward-card preview. Design-first: step state is local;
 * a finish toasts and returns to the list. The seam is the server-driven draft.
 */
export function RewardWizard({ id }: { id?: string }) {
  const t = useTranslations("Rewards");
  const router = useRouter();
  const uploadImage = useUploadImage();
  const [draft, setDraft] = useState<RewardDraft>(
    id ? getRewardDraft(id) : emptyRewardDraft,
  );
  const [stepIndex, setStepIndex] = useState(0);

  const step = STEPS[stepIndex]!;
  const set = <K extends keyof RewardDraft>(key: K, value: RewardDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const steps = STEPS.map((key) => ({ key, label: t(`step.${key}`) }));
  const completed = STEPS.slice(0, stepIndex);

  const onNext = () => {
    if (stepIndex === STEPS.length - 1) {
      toast.success(
        id ? t("updated", { name: draft.name }) : t("created", { name: draft.name }),
      );
      router.push("/rewards");
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
      preview={<RewardPreview draft={draft} t={t} />}
    >
      {step === "basics" ? (
        <div className="space-y-4">
          <Field label={t("fieldName")}>
            <Input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={t("fieldNamePlaceholder")}
              className="h-11 rounded-xl"
              autoFocus
            />
          </Field>
          <Field label={t("fieldIcon")}>
            <IconPicker
              value={draft.emoji}
              onValueChange={(e) => set("emoji", e)}
              emojis={REWARD_EMOJIS}
              customLabel={t("iconCustom")}
              uploadLabel={t("imgUpload")}
              removeLabel={t("imgRemove")}
            />
          </Field>
          <Field label={t("fieldDescription")}>
            <RichTextEditor
              value={draft.description}
              onValueChange={(html) => set("description", html)}
            />
          </Field>
          <Field label={t("fieldBg")}>
            <BackgroundPicker
              value={draft.bg}
              onValueChange={(bg) => set("bg", bg)}
              onUploadImage={uploadImage}
              uploadLabel={t("imgUpload")}
              removeLabel={t("imgRemove")}
            />
          </Field>
        </div>
      ) : step === "cost" ? (
        <div className="space-y-5">
          <Field label={t("fieldCostType")} hint={t("costTypeHint")}>
            <SegmentedControl<CostType>
              value={draft.costType}
              onValueChange={(v) => set("costType", v)}
              options={[
                { value: "stamps", label: t("cost.stampsLabel"), icon: Stamp },
                { value: "points", label: t("cost.pointsLabel"), icon: Coins },
              ]}
            />
          </Field>
          <Field
            label={t("fieldCostValue")}
            hint={
              draft.costType === "stamps" ? t("stampsUnit") : t("pointsUnit")
            }
          >
            <Input
              type="number"
              value={String(draft.cost)}
              onChange={(e) => set("cost", Number(e.target.value) || 0)}
              className="h-11 w-32 rounded-xl"
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
            <ReviewRow
              label={t("fieldCostType")}
              value={t(`cost.${draft.costType}Label`)}
            />
            <ReviewRow
              label={t("fieldCostValue")}
              value={
                draft.cost === 0
                  ? t("free")
                  : t(`cost.${draft.costType}`, { n: draft.cost })
              }
            />
          </dl>
        </div>
      )}
    </WizardShell>
  );
}

function RewardPreview({
  draft,
  t,
}: {
  draft: RewardDraft;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div
      className="preview-customer rounded-3xl p-5 text-white shadow-lg"
      style={{ background: draft.bg }}
    >
      <div className="grid size-14 place-items-center overflow-hidden rounded-2xl bg-white/15 text-3xl">
        <IconGlyph value={draft.emoji} />
      </div>
      <div className="mt-3 font-display text-lg font-semibold">
        {draft.name || t("namePlaceholder")}
      </div>
      {draft.description ? (
        <div
          className="prose prose-sm prose-invert mt-1 line-clamp-2 text-white/85"
          dangerouslySetInnerHTML={{ __html: draft.description }}
        />
      ) : null}
      <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-extrabold">
        {draft.costType === "stamps" ? (
          <Stamp className="size-4" />
        ) : (
          <Coins className="size-4" />
        )}
        {draft.cost === 0 ? t("free") : t(`cost.${draft.costType}`, { n: draft.cost })}
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
        <Label>{label}</Label>
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
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-muted-foreground font-semibold">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}
