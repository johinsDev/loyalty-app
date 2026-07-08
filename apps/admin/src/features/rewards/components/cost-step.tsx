"use client";

import { Input, Label, NumberInput, SegmentedControl, Switch } from "@loyalty/ui";
import { Coins, Stamp, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

const TIERS = ["hoja", "flor", "oro"] as const;
export type TierKey = (typeof TIERS)[number];

export type CostForm = {
  stampsRequired?: number;
  pointsCost?: number;
  costMode: "or" | "and";
  allowedTiers: TierKey[];
  limitPerCustomer: "unlimited" | "once";
  sections: string[];
  sortOrder: number;
};

/** Cost & eligibility: dual currency (stamps/points), or/and mode when both are
 *  set, allowed tiers, per-customer limit, curated section tags + sort order. */
export function CostStepFields({
  value,
  onChange,
}: {
  value: CostForm;
  onChange: (next: CostForm) => void;
}) {
  const t = useTranslations("Rewards.cost");
  const set = <K extends keyof CostForm>(key: K, v: CostForm[K]) => onChange({ ...value, [key]: v });

  const bothSet = value.stampsRequired != null && value.pointsCost != null;
  const [sectionDraft, setSectionDraft] = useState("");

  const addSection = () => {
    const s = sectionDraft.trim().slice(0, 60);
    if (s && !value.sections.includes(s)) set("sections", [...value.sections, s]);
    setSectionDraft("");
  };

  return (
    <div className="space-y-4">
      <div className="border-border grid grid-cols-1 gap-4 rounded-2xl border p-4 sm:grid-cols-2">
        <Field label={t("stamps")} hint={t("currencyHint")}>
          <div className="flex items-center gap-2">
            <Switch
              checked={value.stampsRequired != null}
              onCheckedChange={(on) => set("stampsRequired", on ? (value.stampsRequired ?? 10) : undefined)}
              aria-label={t("stampsToggle")}
            />
            <NumberInput
              value={value.stampsRequired}
              onValueChange={(v) => set("stampsRequired", v)}
              disabled={value.stampsRequired == null}
              suffix={` ${t("stampsUnit")}`}
              className="h-10 flex-1"
            />
          </div>
        </Field>
        <Field label={t("points")} hint={t("currencyHint")}>
          <div className="flex items-center gap-2">
            <Switch
              checked={value.pointsCost != null}
              onCheckedChange={(on) => set("pointsCost", on ? (value.pointsCost ?? 100) : undefined)}
              aria-label={t("pointsToggle")}
            />
            <NumberInput
              value={value.pointsCost}
              onValueChange={(v) => set("pointsCost", v)}
              disabled={value.pointsCost == null}
              suffix={` ${t("pointsUnit")}`}
              className="h-10 flex-1"
            />
          </div>
        </Field>
      </div>

      {bothSet ? (
        <Field label={t("costMode")} hint={t("costModeHint")}>
          <SegmentedControl<"or" | "and">
            value={value.costMode}
            onValueChange={(v) => set("costMode", v)}
            options={[
              { value: "or", label: t("modeOr"), icon: Coins },
              { value: "and", label: t("modeAnd"), icon: Stamp },
            ]}
          />
        </Field>
      ) : null}

      <div className="border-border space-y-4 rounded-2xl border p-4">
        <Field label={t("allowedTiers")} hint={t("allowedTiersHint")}>
          <div className="flex flex-wrap gap-2">
            {TIERS.map((tier) => {
              const active = value.allowedTiers.includes(tier);
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() =>
                    set(
                      "allowedTiers",
                      active
                        ? value.allowedTiers.filter((x) => x !== tier)
                        : [...value.allowedTiers, tier],
                    )
                  }
                  className={
                    active
                      ? "bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-xs font-bold capitalize"
                      : "border-border text-muted-foreground rounded-lg border px-3 py-1.5 text-xs font-bold capitalize"
                  }
                >
                  {tier}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label={t("limit")} hint={t("limitHint")}>
          <SegmentedControl<"unlimited" | "once">
            value={value.limitPerCustomer}
            onValueChange={(v) => set("limitPerCustomer", v)}
            options={[
              { value: "unlimited", label: t("limitUnlimited") },
              { value: "once", label: t("limitOnce") },
            ]}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("sections")} hint={t("sectionsHint")}>
          <div className="space-y-2">
            {value.sections.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {value.sections.map((s) => (
                  <span
                    key={s}
                    className="bg-muted inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold"
                  >
                    {s}
                    <button
                      type="button"
                      aria-label={t("removeSection")}
                      onClick={() => set("sections", value.sections.filter((x) => x !== s))}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <Input
              value={sectionDraft}
              onChange={(e) => setSectionDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSection();
                }
              }}
              onBlur={addSection}
              placeholder={t("sectionsPlaceholder")}
              className="h-10"
            />
          </div>
        </Field>
        <Field label={t("sortOrder")} hint={t("sortOrderHint")}>
          <NumberInput
            value={value.sortOrder}
            onValueChange={(v) => set("sortOrder", v ?? 0)}
            className="h-10 w-28"
          />
        </Field>
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
