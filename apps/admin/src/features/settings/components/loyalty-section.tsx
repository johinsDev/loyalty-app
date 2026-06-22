"use client";

import { Label, NumberInput, SegmentedControl } from "@loyalty/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { loyalty, type LoyaltyMode } from "../data";

/**
 * Loyalty rules editor (earn / redeem). Design-first: state is local, seeded
 * from the hardcoded `loyalty` config. Seam: a future `settings.loyalty`
 * mutation backing the org's earn/redeem rules.
 */
export function LoyaltySection() {
  const t = useTranslations("Settings");
  const [mode, setMode] = useState<LoyaltyMode>(loyalty.mode);
  const [stampsPerReward, setStampsPerReward] = useState(
    loyalty.stampsPerReward,
  );
  const [pointsPerCurrency, setPointsPerCurrency] = useState(
    loyalty.pointsPerCurrency,
  );
  const [expiryDays, setExpiryDays] = useState(loyalty.expiryDays);

  const showStamps = mode === "stamps" || mode === "both";
  const showPoints = mode === "points" || mode === "both";

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {t("loyalty.title")}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("loyalty.desc")}
        </p>
      </div>

      <SegmentedControl<LoyaltyMode>
        value={mode}
        onValueChange={setMode}
        options={[
          { value: "stamps", label: t("loyalty.modeOpt.stamps") },
          { value: "points", label: t("loyalty.modeOpt.points") },
          { value: "both", label: t("loyalty.modeOpt.both") },
        ]}
      />

      <div className="space-y-4">
        {showStamps ? (
          <Field
            label={t("loyalty.stampsPerReward")}
            hint={t("loyalty.stampsPerRewardHint")}
          >
            <NumberInput
              value={stampsPerReward}
              onValueChange={(v) => setStampsPerReward(v ?? 0)}
              className="h-10"
            />
          </Field>
        ) : null}
        {showPoints ? (
          <Field
            label={t("loyalty.pointsPerCurrency")}
            hint={t("loyalty.pointsPerCurrencyHint")}
          >
            <NumberInput
              value={pointsPerCurrency}
              onValueChange={(v) => setPointsPerCurrency(v ?? 0)}
              className="h-10"
            />
          </Field>
        ) : null}
        <Field label={t("loyalty.expiryDays")} hint={t("loyalty.expiryHint")}>
          <NumberInput
            value={expiryDays}
            onValueChange={(v) => setExpiryDays(v ?? 0)}
            className="h-10"
          />
        </Field>
      </div>
    </section>
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
      <Label className="text-xs">{label}</Label>
      {children}
      {hint ? (
        <p className="text-muted-foreground/70 text-xs font-semibold">{hint}</p>
      ) : null}
    </div>
  );
}
