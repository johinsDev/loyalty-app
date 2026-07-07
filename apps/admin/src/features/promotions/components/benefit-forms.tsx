"use client";

import type { BenefitConfig } from "@loyalty/api/features/promotions/rule-compile";
import type { PromoType } from "@loyalty/api/features/promotions/schemas";
import { Button, Label, NumberInput } from "@loyalty/ui";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { RefsField, type ItemRef } from "./refs-field";

type Requirement = { refs: ItemRef[]; qty: number };
type MoneyBenefit =
  | { kind: "percent"; percent: number; maxDiscountCents?: number }
  | { kind: "amount"; amountCents: number };

const centsToUnits = (c: number | undefined): number | undefined =>
  c == null ? undefined : Math.round(c) / 100;
const unitsToCents = (u: number | undefined): number | undefined =>
  u == null ? undefined : Math.round(u * 100);

/** Sensible per-type starting config for a blank benefit step. */
export function defaultConfigFor(type: PromoType): BenefitConfig {
  switch (type) {
    case "percentOff":
      return { type, refs: [], percent: 10 };
    case "amountOff":
      return { type, refs: [], amountCents: 500000 };
    case "nxm":
      return { type, refs: [], buyQty: 2, payQty: 1 };
    case "secondUnit":
      return { type, refs: [], percent: 50 };
    case "bundle":
      return {
        type,
        requirements: [
          { refs: [], qty: 1 },
          { refs: [], qty: 1 },
        ],
        benefit: { kind: "percent", percent: 15 },
      };
    case "combo":
      return { type, requirements: [{ refs: [], qty: 2 }], priceCents: 2500000 };
    case "crossSell":
      return {
        type,
        buy: [{ refs: [], qty: 1 }],
        get: [{ refs: [], qty: 1 }],
        percent: 100,
        maxApplicationsPerOrder: 1,
      };
    case "cartThreshold":
      return { type, minSubtotalCents: 3000000, benefit: { kind: "amount", amountCents: 500000 } };
    case "volumeTiered":
      return {
        type,
        refs: [],
        tiers: [
          { minQty: 1, percent: 5 },
          { minQty: 3, percent: 15 },
          { minQty: 5, percent: 25 },
        ],
      };
    case "pointsMultiplier":
      return { type, refs: [], multiplier: 2 };
    default:
      return { type: "percentOff", refs: [], percent: 10 };
  }
}

/** The per-type benefit form. Renders only the picked type's fields; the
 *  config compiles server-side into the generic rule. */
export function BenefitConfigFields({
  value,
  onChange,
}: {
  value: BenefitConfig;
  onChange: (next: BenefitConfig) => void;
}) {
  const t = useTranslations("Promotions.benefit");

  switch (value.type) {
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
    case "nxm":
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("buyQty")}>
              <NumberInput
                value={value.buyQty}
                onValueChange={(v) => onChange({ ...value, buyQty: v ?? 2 })}
                className="h-10"
              />
            </Field>
            <Field label={t("payQty")} hint={t("payQtyHint")}>
              <NumberInput
                value={value.payQty}
                onValueChange={(v) => onChange({ ...value, payQty: v ?? 1 })}
                className="h-10"
              />
            </Field>
          </div>
          <Field label={t("among")} hint={t("amongHint")}>
            <RefsField
              value={value.refs}
              onChange={(refs) => onChange({ ...value, refs })}
              anyLabel={t("anyItem")}
            />
          </Field>
          <MaxAppsField
            value={value.maxApplicationsPerOrder}
            onChange={(m) => onChange({ ...value, maxApplicationsPerOrder: m })}
          />
        </div>
      );
    case "secondUnit":
      return (
        <div className="space-y-4">
          <Field label={t("secondUnitPercent")} hint={t("secondUnitHint")}>
            <NumberInput
              value={value.percent}
              onValueChange={(v) => onChange({ ...value, percent: v ?? 50 })}
              suffix=" %"
              className="h-10"
            />
          </Field>
          <Field label={t("among")} hint={t("amongHint")}>
            <RefsField
              value={value.refs}
              onChange={(refs) => onChange({ ...value, refs })}
              anyLabel={t("anyItem")}
            />
          </Field>
          <MaxAppsField
            value={value.maxApplicationsPerOrder}
            onChange={(m) => onChange({ ...value, maxApplicationsPerOrder: m })}
          />
        </div>
      );
    case "bundle":
      return (
        <div className="space-y-4">
          <RequirementsField
            value={value.requirements}
            onChange={(requirements) => onChange({ ...value, requirements })}
          />
          <MoneyBenefitFields
            value={value.benefit}
            onChange={(benefit) => onChange({ ...value, benefit })}
          />
          <MaxAppsField
            value={value.maxApplicationsPerOrder}
            onChange={(m) => onChange({ ...value, maxApplicationsPerOrder: m })}
          />
        </div>
      );
    case "combo":
      return (
        <div className="space-y-4">
          <RequirementsField
            value={value.requirements}
            onChange={(requirements) => onChange({ ...value, requirements })}
          />
          <Field label={t("comboPrice")} hint={t("comboPriceHint")}>
            <NumberInput
              value={centsToUnits(value.priceCents)}
              onValueChange={(v) => onChange({ ...value, priceCents: unitsToCents(v) ?? 0 })}
              className="h-10"
            />
          </Field>
          <MaxAppsField
            value={value.maxApplicationsPerOrder}
            onChange={(m) => onChange({ ...value, maxApplicationsPerOrder: m })}
          />
        </div>
      );
    case "crossSell":
      return (
        <div className="space-y-4">
          <div className="border-border rounded-2xl border p-4">
            <p className="mb-3 text-sm font-semibold">{t("buySide")}</p>
            <RequirementsField
              value={value.buy}
              onChange={(buy) => onChange({ ...value, buy })}
              allowEmpty
            />
          </div>
          <div className="border-border rounded-2xl border p-4">
            <p className="mb-3 text-sm font-semibold">{t("getSide")}</p>
            <RequirementsField
              value={value.get}
              onChange={(get) => onChange({ ...value, get })}
            />
          </div>
          <Field label={t("getPercent")} hint={t("getPercentHint")}>
            <NumberInput
              value={value.percent}
              onValueChange={(v) => onChange({ ...value, percent: v ?? 100 })}
              suffix=" %"
              className="h-10"
            />
          </Field>
          <MaxAppsField
            value={value.maxApplicationsPerOrder}
            onChange={(m) => onChange({ ...value, maxApplicationsPerOrder: m })}
          />
        </div>
      );
    case "cartThreshold":
      return (
        <div className="space-y-4">
          <Field label={t("threshold")} hint={t("thresholdHint")}>
            <NumberInput
              value={centsToUnits(value.minSubtotalCents)}
              onValueChange={(v) => onChange({ ...value, minSubtotalCents: unitsToCents(v) ?? 0 })}
              className="h-10"
            />
          </Field>
          <MoneyBenefitFields
            value={value.benefit}
            onChange={(benefit) => onChange({ ...value, benefit })}
          />
        </div>
      );
    case "volumeTiered":
      return (
        <div className="space-y-4">
          <Field label={t("among")} hint={t("amongHint")}>
            <RefsField
              value={value.refs}
              onChange={(refs) => onChange({ ...value, refs })}
              anyLabel={t("anyItem")}
            />
          </Field>
          <TiersField value={value.tiers} onChange={(tiers) => onChange({ ...value, tiers })} />
        </div>
      );
    case "pointsMultiplier":
      return (
        <div className="space-y-4">
          <Field label={t("multiplier")}>
            <NumberInput
              value={value.multiplier}
              onValueChange={(v) => onChange({ ...value, multiplier: v ?? 2 })}
              suffix="x"
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
    default:
      return null;
  }
}

function RequirementsField({
  value,
  onChange,
  allowEmpty = false,
}: {
  value: Requirement[];
  onChange: (reqs: Requirement[]) => void;
  allowEmpty?: boolean;
}) {
  const t = useTranslations("Promotions.benefit");
  const setRow = (i: number, next: Requirement) =>
    onChange(value.map((r, idx) => (idx === i ? next : r)));
  const removeRow = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {value.length === 0 && allowEmpty ? (
        <p className="text-muted-foreground text-xs">{t("noRequirement")}</p>
      ) : null}
      {value.map((req, i) => (
        <div key={i} className="border-border space-y-2 rounded-xl border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs">{t("qty")}</Label>
              <NumberInput
                value={req.qty}
                onValueChange={(v) => setRow(i, { ...req, qty: v ?? 1 })}
                className="h-10 w-20"
              />
            </div>
            {value.length > (allowEmpty ? 0 : 1) ? (
              <Button
                type="button"
                variant="ghost"
                className="size-8 rounded-lg p-0"
                aria-label={t("removeRequirement")}
                onClick={() => removeRow(i)}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
          <RefsField
            value={req.refs}
            onChange={(refs) => setRow(i, { ...req, refs })}
            anyLabel={t("anyItem")}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="h-9 gap-1.5 rounded-lg text-xs"
        onClick={() => onChange([...value, { refs: [], qty: 1 }])}
      >
        <Plus className="size-3.5" />
        {t("addRequirement")}
      </Button>
    </div>
  );
}

function MoneyBenefitFields({
  value,
  onChange,
}: {
  value: MoneyBenefit;
  onChange: (b: MoneyBenefit) => void;
}) {
  const t = useTranslations("Promotions.benefit");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {(["percent", "amount"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() =>
              onChange(
                kind === "percent"
                  ? { kind, percent: value.kind === "percent" ? value.percent : 15 }
                  : { kind, amountCents: value.kind === "amount" ? value.amountCents : 500000 },
              )
            }
            className={`rounded-xl border p-3 text-left text-sm font-semibold transition-colors ${
              value.kind === kind
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40"
            }`}
          >
            {t(`money.${kind}`)}
          </button>
        ))}
      </div>
      {value.kind === "percent" ? (
        <Field label={t("percent")}>
          <NumberInput
            value={value.percent}
            onValueChange={(v) => onChange({ ...value, percent: v ?? 1 })}
            suffix=" %"
            className="h-10"
          />
        </Field>
      ) : (
        <Field label={t("amount")}>
          <NumberInput
            value={centsToUnits(value.amountCents)}
            onValueChange={(v) => onChange({ ...value, amountCents: unitsToCents(v) ?? 0 })}
            className="h-10"
          />
        </Field>
      )}
    </div>
  );
}

function TiersField({
  value,
  onChange,
}: {
  value: { minQty: number; percent: number }[];
  onChange: (tiers: { minQty: number; percent: number }[]) => void;
}) {
  const t = useTranslations("Promotions.benefit");
  return (
    <div className="space-y-2">
      <Label className="text-xs">{t("tiers")}</Label>
      {value.map((tier, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs font-semibold">{t("tierFrom")}</span>
          <NumberInput
            value={tier.minQty}
            onValueChange={(v) =>
              onChange(value.map((x, idx) => (idx === i ? { ...x, minQty: v ?? 1 } : x)))
            }
            className="h-10 w-20"
          />
          <span className="text-muted-foreground text-xs font-semibold">→</span>
          <NumberInput
            value={tier.percent}
            onValueChange={(v) =>
              onChange(value.map((x, idx) => (idx === i ? { ...x, percent: v ?? 1 } : x)))
            }
            suffix=" %"
            className="h-10 w-24"
          />
          {value.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              className="size-8 rounded-lg p-0"
              aria-label={t("removeTier")}
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="h-9 gap-1.5 rounded-lg text-xs"
        onClick={() =>
          onChange([
            ...value,
            { minQty: (value[value.length - 1]?.minQty ?? 0) + 2, percent: 10 },
          ])
        }
      >
        <Plus className="size-3.5" />
        {t("addTier")}
      </Button>
    </div>
  );
}

function MaxAppsField({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  const t = useTranslations("Promotions.benefit");
  return (
    <Field label={t("maxApps")} hint={t("maxAppsHint")}>
      <NumberInput value={value} onValueChange={onChange} className="h-10 w-32" />
    </Field>
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
