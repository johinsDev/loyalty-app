"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import type { RewardBenefitConfigInput } from "@loyalty/api/features/rewards/schemas";

import { Link } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

/** The variantUpgrade member of the benefit union, so the field slots straight
 *  into the shared `onChange` without widening it. */
type Value = Extract<RewardBenefitConfigInput, { type: "variantUpgrade" }>;

const fmtCop = (cents: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(cents) / 100);

/**
 * Picks the (option, from, to) triple from what the catalog actually has.
 *
 * This replaces three free-text inputs whose values were matched with exact
 * equality against a per-product, duplicated vocabulary — a missing accent gave
 * you a reward that never applied, with nothing anywhere to say so.
 *
 * It also shows coverage, because a category almost never covers all its
 * products: in this catalog "Frutales" has variants on 1 of its 4.
 */
export function VariantAxisField({
  value,
  onChange,
}: {
  value: Value;
  onChange: (next: Value) => void;
}) {
  const t = useTranslations("Rewards.benefit");
  const trpc = useTRPC();

  const complete = Boolean(value.optionName && value.fromValueLabel && value.toValueLabel);
  const query = useQuery(
    trpc.promociones.variantAxes.queryOptions({
      refs: value.refs,
      ...(complete
        ? {
            optionName: value.optionName,
            fromValueLabel: value.fromValueLabel,
            toValueLabel: value.toValueLabel,
          }
        : {}),
    }),
  );

  const data = query.data;
  const axes = data?.axes ?? [];
  const axis = axes.find((a) => a.optionName === value.optionName) ?? null;

  // With one axis and two values — the shape of this catalog — the admin's only
  // real decision is the scope, so don't make them restate the obvious.
  useEffect(() => {
    if (!data || axes.length === 0) return;
    const only = axes.length === 1 ? axes[0]! : null;
    const picked = axes.find((a) => a.optionName === value.optionName) ?? only;
    if (!picked) return;
    const next = { ...value, optionName: picked.optionName };
    if (picked.values.length === 2 && !value.fromValueLabel && !value.toValueLabel) {
      // Cheapest → priciest is the only sensible default direction, and the
      // server rejects the reverse anyway (a target that isn't pricier).
      next.fromValueLabel = picked.values[1]!.label;
      next.toValueLabel = picked.values[0]!.label;
    }
    if (
      next.optionName !== value.optionName ||
      next.fromValueLabel !== value.fromValueLabel ||
      next.toValueLabel !== value.toValueLabel
    ) {
      onChange(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (query.isPending) {
    return <p className="text-muted-foreground text-xs font-semibold">{t("upgradeLoading")}</p>;
  }

  if (axes.length === 0) {
    return (
      <div className="border-border space-y-2 rounded-xl border px-3.5 py-3">
        <p className="text-muted-foreground text-xs font-semibold">{t("upgradeNoAxes")}</p>
        <Link href="/products" className="text-primary text-xs font-extrabold underline">
          {t("upgradeNoAxesCta")}
        </Link>
      </div>
    );
  }

  const labels = axis?.values.map((v) => v.label) ?? [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Labelled label={t("upgradeOption")}>
          <Select
            value={value.optionName || undefined}
            onValueChange={(v) =>
              v && onChange({ ...value, optionName: v, fromValueLabel: "", toValueLabel: "" })
            }
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder={t("upgradePickAxis")} />
            </SelectTrigger>
            <SelectContent>
              {axes.map((a) => (
                <SelectItem key={a.optionName} value={a.optionName}>
                  {a.optionName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Labelled>

        <Labelled label={t("upgradeFrom")}>
          <Select
            value={value.fromValueLabel || undefined}
            onValueChange={(v) => v && onChange({ ...value, fromValueLabel: v })}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder={t("upgradePickFrom")} />
            </SelectTrigger>
            <SelectContent>
              {labels.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Labelled>

        <Labelled label={t("upgradeTo")}>
          <Select
            value={value.toValueLabel || undefined}
            onValueChange={(v) => v && onChange({ ...value, toValueLabel: v })}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder={t("upgradePickTo")} />
            </SelectTrigger>
            <SelectContent>
              {/* Same value on both sides isn't a swap. */}
              {labels
                .filter((l) => l !== value.fromValueLabel)
                .map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Labelled>
      </div>

      {axis ? (
        <div className="text-muted-foreground space-y-1 text-xs font-semibold">
          <p>
            {axis.optionName} —{" "}
            {t("upgradeCoverage", { covered: axis.coveredCount, total: data!.productCount })}
          </p>
          {axis.missing.length > 0 ? (
            <p className="text-muted-foreground/70">
              {t("upgradeMissing", {
                names: axis.missing
                  .slice(0, 3)
                  .map((m) => m.name)
                  .join(", "),
              })}
              {axis.missing.length > 3
                ? ` ${t("upgradeMissingMore", { n: axis.missing.length - 3 })}`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      {data?.pair ? (
        <div className="bg-muted/40 space-y-1 rounded-xl px-3.5 py-3">
          {data.pair.eligibleCount === 0 ? (
            <p className="text-destructive text-xs font-semibold">{t("upgradeNoneEligible")}</p>
          ) : (
            <p className="text-xs font-semibold">
              {data.pair.minDeltaCents === data.pair.maxDeltaCents
                ? t("upgradeCost", { amount: fmtCop(data.pair.minDeltaCents) })
                : t("upgradeCostRange", {
                    min: fmtCop(data.pair.minDeltaCents),
                    max: fmtCop(data.pair.maxDeltaCents),
                  })}
            </p>
          )}
          <p className="text-muted-foreground/70 text-xs font-semibold">
            {t("upgradeStackingNote")}
          </p>
        </div>
      ) : null}

      {data && data.unknownRefs.length > 0 ? (
        <p className="text-destructive text-xs font-semibold">
          {t("upgradeUnknownRefs", { n: data.unknownRefs.length })}
        </p>
      ) : null}
    </div>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="text-muted-foreground text-xs font-semibold">{label}</span>
      {children}
    </div>
  );
}
