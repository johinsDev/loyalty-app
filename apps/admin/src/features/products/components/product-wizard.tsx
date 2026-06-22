"use client";

import {
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Switch,
  Textarea,
} from "@loyalty/ui";
import { Stamp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { WizardShell } from "@/components/wizard-shell";
import { useRouter } from "@/i18n/navigation";

import {
  type Category,
  categories,
  emptyProductDraft,
  getProductDraft,
  PRODUCT_EMOJIS,
  type ProductDraft,
} from "../data";

const STEPS = ["basics", "photo", "reward", "review"] as const;
type Step = (typeof STEPS)[number];

/**
 * Product create/edit wizard (datos → foto → recompensa → revisar) with a live
 * product-card preview. Design-first: step state is local; a finish toasts and
 * returns to the list. The seam is the server-driven draft (PromoWizard +
 * `wizard` skill).
 */
export function ProductWizard({ id }: { id?: string }) {
  const t = useTranslations("Products");
  const router = useRouter();
  const [draft, setDraft] = useState<ProductDraft>(
    id ? getProductDraft(id) : emptyProductDraft,
  );
  const [stepIndex, setStepIndex] = useState(0);

  const step = STEPS[stepIndex]!;
  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const steps = STEPS.map((key) => ({ key, label: t(`step.${key}`) }));
  const completed = STEPS.slice(0, stepIndex);

  const onNext = () => {
    if (stepIndex === STEPS.length - 1) {
      toast.success(id ? t("updated", { name: draft.name }) : t("created", { name: draft.name }));
      router.push("/products");
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
      preview={<ProductPreview draft={draft} t={t} />}
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
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("fieldCategory")}>
              <NativeSelect
                value={draft.category}
                onChange={(e) => set("category", e.target.value as Category)}
                className="h-11 rounded-xl"
              >
                {categories.map((c) => (
                  <NativeSelectOption key={c} value={c}>
                    {t(`category.${c}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t("fieldPrice")} hint={t("priceOptional")}>
              <Input
                value={draft.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="$0.00"
                className="h-11 rounded-xl"
              />
            </Field>
          </div>
          <Field label={t("fieldDescription")}>
            <Textarea
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder={t("fieldDescriptionPlaceholder")}
              rows={3}
              className="rounded-xl"
            />
          </Field>
        </div>
      ) : step === "photo" ? (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm font-semibold">
            {t("photoHint")}
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {PRODUCT_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => set("emoji", e)}
                className={`grid aspect-square place-items-center rounded-2xl text-3xl transition-colors ${
                  draft.emoji === e
                    ? "bg-primary/10 ring-primary ring-2"
                    : "bg-muted/50 hover:bg-muted"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      ) : step === "reward" ? (
        <div className="space-y-5">
          <div className="border-border flex items-center justify-between rounded-2xl border p-4">
            <div>
              <div className="flex items-center gap-2 font-bold">
                <Stamp className="text-primary size-4" />
                {t("earnsStampLabel")}
              </div>
              <p className="text-muted-foreground/80 mt-0.5 text-xs font-semibold">
                {t("earnsStampHint")}
              </p>
            </div>
            <Switch
              checked={draft.earnsStamp}
              onCheckedChange={(c) => set("earnsStamp", c)}
            />
          </div>
          <Field label={t("fieldPoints")} hint={t("pointsHint")}>
            <Input
              type="number"
              value={String(draft.points)}
              onChange={(e) => set("points", Number(e.target.value) || 0)}
              className="h-11 w-32 rounded-xl"
              disabled={!draft.earnsStamp}
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
              label={t("fieldCategory")}
              value={t(`category.${draft.category}`)}
            />
            <ReviewRow label={t("fieldPrice")} value={draft.price || "—"} />
            <ReviewRow
              label={t("earnsStampLabel")}
              value={draft.earnsStamp ? t("yes") : t("no")}
            />
            <ReviewRow label={t("fieldPoints")} value={`${draft.points} pts`} />
          </dl>
        </div>
      )}
    </WizardShell>
  );
}

function ProductPreview({
  draft,
  t,
}: {
  draft: ProductDraft;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="bg-card border-border rounded-3xl border p-4 shadow-sm">
      <div className="bg-muted/50 grid aspect-square place-items-center rounded-2xl text-6xl">
        {draft.emoji}
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-bold">
            {draft.name || t("namePlaceholder")}
          </div>
          <div className="text-muted-foreground/70 text-xs font-semibold">
            {t(`category.${draft.category}`)}
          </div>
        </div>
        <span className="font-bold">{draft.price || "—"}</span>
      </div>
      {draft.description ? (
        <p className="text-muted-foreground/80 mt-2 line-clamp-2 text-xs font-semibold">
          {draft.description}
        </p>
      ) : null}
      {draft.earnsStamp ? (
        <span className="bg-primary/10 text-primary mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold">
          <Stamp className="size-3" />
          {t("earnsStamp")} · +{draft.points} pts
        </span>
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
