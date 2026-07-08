"use client";

import type { RewardBenefitConfigInput, RewardType } from "@loyalty/api/features/rewards/schemas";
import { Label, NumberInput } from "@loyalty/ui";
import { useTranslations } from "next-intl";

import { RefsField } from "@/components/refs-field";

const centsToUnits = (c: number | undefined): number | undefined =>
  c == null ? undefined : Math.round(c) / 100;
const unitsToCents = (u: number | undefined): number | undefined =>
  u == null ? undefined : Math.round(u * 100);

/** Sensible per-type starting config for a blank benefit step. */
export function defaultConfigFor(type: RewardType): RewardBenefitConfigInput {
  switch (type) {
    case "freeProduct":
      return { type, refs: [] };
    case "amountOff":
      return { type, refs: [], amountCents: 500000 };
    case "percentOff":
      return { type, refs: [], percent: 20 };
    case "experience":
      return { type };
    default:
      return { type: "freeProduct", refs: [] };
  }
}

/** The per-type reward benefit form. Renders only the picked type's fields; the
 *  config compiles server-side into the generic rule (experience → none). */
export function RewardBenefitFields({
  value,
  onChange,
}: {
  value: RewardBenefitConfigInput;
  onChange: (next: RewardBenefitConfigInput) => void;
}) {
  const t = useTranslations("Rewards.benefit");

  switch (value.type) {
    case "freeProduct":
      return (
        <Field label={t("freeProductItems")} hint={t("freeProductHint")}>
          <RefsField
            value={value.refs}
            onChange={(refs) => onChange({ ...value, refs })}
            anyLabel={t("pickAtLeastOne")}
          />
        </Field>
      );
    case "amountOff":
      return (
        <div className="space-y-4">
          <Field label={t("amount")}>
            <NumberInput
              value={centsToUnits(value.amountCents)}
              onValueChange={(v) => onChange({ ...value, amountCents: unitsToCents(v) ?? 0 })}
              className="h-10"
            />
          </Field>
          <Field label={t("appliesTo")} hint={t("appliesToHint")}>
            <RefsField
              value={value.refs}
              onChange={(refs) => onChange({ ...value, refs })}
              anyLabel={t("wholeOrder")}
            />
          </Field>
        </div>
      );
    case "percentOff":
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("percent")}>
              <NumberInput
                value={value.percent}
                onValueChange={(v) => onChange({ ...value, percent: v ?? 1 })}
                suffix=" %"
                className="h-10"
              />
            </Field>
            <Field label={t("maxDiscount")} hint={t("optional")}>
              <NumberInput
                value={centsToUnits(value.maxDiscountCents)}
                onValueChange={(v) => onChange({ ...value, maxDiscountCents: unitsToCents(v) })}
                className="h-10"
              />
            </Field>
          </div>
          <Field label={t("appliesTo")} hint={t("appliesToHint")}>
            <RefsField
              value={value.refs}
              onChange={(refs) => onChange({ ...value, refs })}
              anyLabel={t("wholeOrder")}
            />
          </Field>
        </div>
      );
    case "experience":
      return (
        <div className="border-primary/20 bg-primary/5 rounded-2xl border px-4 py-3">
          <p className="text-sm font-semibold">{t("experienceTitle")}</p>
          <p className="text-muted-foreground mt-1 text-xs">{t("experienceHint")}</p>
        </div>
      );
    default:
      return null;
  }
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
