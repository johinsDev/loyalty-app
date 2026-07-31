"use client";

import type { RewardBenefitConfigInput } from "@loyalty/api/features/rewards/schemas";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { RefsField } from "@/components/refs-field";
import { Link } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

type Value = Extract<RewardBenefitConfigInput, { type: "variantUpgrade" }>;

const fmtCop = (cents: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(cents) / 100);

/**
 * Scope, coverage and axis as one block.
 *
 * The shape follows from two things. The headline IS the reward's sentence, so
 * there is no separate "this is how it reads" box restating it. And the axis
 * sits at the foot as a confirmation rather than a question, because a real
 * catalog has one axis with two values — the admin's only actual decision is the
 * scope, and coverage is what they need in front of them while making it.
 *
 * Coverage lives inside the scope frame on purpose: "1 de 4 productos" is the
 * fact most likely to be skipped, so it belongs against the choice that caused
 * it rather than in a grey box below.
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
  const [editingAxis, setEditingAxis] = useState(false);

  const complete = Boolean(value.optionName && value.fromValueLabel && value.toValueLabel);
  const { data, isPending } = useQuery(
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

  const axes = data?.axes ?? [];
  const axis = axes.find((a) => a.optionName === value.optionName) ?? null;
  const pair = data?.pair ?? null;
  const eligible = pair?.eligibleCount ?? 0;
  const total = data?.productCount ?? 0;
  const covered = axis?.coveredCount ?? 0;

  // One axis with two values is the common catalog: fill it in rather than
  // making the admin restate what the menu already says.
  useEffect(() => {
    if (!data || axes.length === 0) return;
    const picked =
      axes.find((a) => a.optionName === value.optionName) ?? (axes.length === 1 ? axes[0]! : null);
    if (!picked) return;
    const next = { ...value, optionName: picked.optionName };
    if (picked.values.length === 2 && !value.fromValueLabel && !value.toValueLabel) {
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

  const scope = data?.scopeLabel ?? null;
  const headline = !complete
    ? t("upgradeHeadlinePending")
    : axes.length === 0 && total > 0
      ? t("upgradeHeadlineNoAxes")
      : eligible === 0 && total > 0
        ? t("upgradeHeadlineNoneEligible", { from: value.fromValueLabel, to: value.toValueLabel })
        : scope
          ? t("upgradeHeadlineScoped", { from: value.fromValueLabel, to: value.toValueLabel, scope })
          : t("upgradeHeadline", { from: value.fromValueLabel, to: value.toValueLabel });

  const cost =
    !pair || eligible === 0
      ? t("upgradeCostNone")
      : pair.minDeltaCents === pair.maxDeltaCents
        ? fmtCop(pair.minDeltaCents)
        : `${fmtCop(pair.minDeltaCents)} – ${fmtCop(pair.maxDeltaCents)}`;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-lg leading-snug font-semibold tracking-tight">
            {headline}
          </p>
          <p className="text-muted-foreground/70 mt-0.5 text-xs font-semibold">
            {t("upgradeScopeHint")}
          </p>
        </div>
        <div className="flex-none text-right">
          <p className="text-muted-foreground/70 text-[0.625rem] font-extrabold tracking-wider uppercase">
            {t("upgradeCostLabel")}
          </p>
          <p className="text-base font-extrabold">{cost}</p>
        </div>
      </div>

      <div className="border-border overflow-hidden rounded-2xl border">
        <div className="p-2.5">
          <RefsField
            value={value.refs}
            onChange={(refs) => onChange({ ...value, refs })}
            anyLabel={t("upgradeAnyProduct")}
            allowVariantRefine={false}
          />
        </div>
        {isPending ? (
          <p className="text-muted-foreground border-border border-t px-3.5 py-3 text-xs font-semibold">
            {t("upgradeLoading")}
          </p>
        ) : (
          <CoverageBlock
            axisName={axis?.optionName ?? value.optionName}
            covered={covered}
            total={total}
            products={pair?.products ?? []}
            missing={axis?.missing ?? []}
            hasAxes={axes.length > 0}
          />
        )}
      </div>

      {data && !isPending ? (
        <Callout
          axes={axes.length}
          eligible={eligible}
          total={total}
          covered={covered}
          suggested={data.suggestedPair}
          unknownRefs={data.unknownRefs.length}
          onUseSuggested={(from, to) =>
            onChange({ ...value, fromValueLabel: from, toValueLabel: to })
          }
          onKeepOnlyEligible={() =>
            onChange({
              ...value,
              refs: (pair?.products ?? [])
                .filter((p) => p.deltaCents != null)
                .map((p) => ({ kind: "product" as const, id: p.productId })),
            })
          }
        />
      ) : null}

      {/* A confirmation, not a question — settled unless the admin opens it. */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
        {editingAxis ? (
          <AxisEditor value={value} axes={axes} onChange={onChange} />
        ) : (
          <span className="text-muted-foreground min-w-0 truncate">
            {complete
              ? t("upgradeAxisSettled", {
                  axis: value.optionName,
                  from: value.fromValueLabel,
                  to: value.toValueLabel,
                })
              : t("upgradePickAxis")}
          </span>
        )}
        {axes.length > 0 ? (
          <button
            type="button"
            onClick={() => setEditingAxis((v) => !v)}
            className="text-primary flex-none font-extrabold underline"
          >
            {editingAxis ? t("upgradeAxisDone") : t("upgradeAxisChange")}
          </button>
        ) : null}
      </div>

      <p className="text-muted-foreground/70 text-xs font-semibold">{t("upgradeStackingNote")}</p>
    </div>
  );
}

function CoverageBlock({
  axisName,
  covered,
  total,
  products,
  missing,
  hasAxes,
}: {
  axisName: string;
  covered: number;
  total: number;
  products: {
    id: string;
    name: string;
    productId: string;
    deltaCents: number | null;
    reason: string | null;
  }[];
  missing: { id: string; name: string }[];
  hasAxes: boolean;
}) {
  const t = useTranslations("Rewards.benefit");
  if (total === 0) return null;

  // Before a pair is chosen there are no per-product rows; fall back to the
  // axis's own missing list so coverage still shows something true.
  const rows = products.length
    ? products
    : missing.map((m) => ({
        id: m.id,
        name: m.name,
        productId: m.id,
        deltaCents: null,
        reason: "no-axis",
      }));

  return (
    <div className="border-border border-t">
      <div className="flex items-center gap-2 px-3.5 pt-2.5">
        <span className="text-muted-foreground text-[0.625rem] font-extrabold tracking-wider uppercase">
          {hasAxes
            ? t("upgradeCoverageHeader", { axis: axisName, covered, total })
            : t("upgradeNoVariantsHeader")}
        </span>
        <span className="ml-auto flex flex-none gap-0.5" aria-hidden>
          {Array.from({ length: Math.min(total, 8) }).map((_, i) => (
            <span
              key={i}
              className={`h-1 w-6 rounded-full ${i < covered ? "bg-emerald-500" : "bg-muted"}`}
            />
          ))}
        </span>
      </div>
      <ul className="space-y-0.5 px-3.5 py-2">
        {rows.slice(0, 8).map((p) => (
          <li key={p.id} className="flex items-center gap-2 text-xs font-semibold">
            <span
              className={`size-1.5 flex-none rounded-full ${p.deltaCents != null ? "bg-emerald-500" : "bg-amber-500"}`}
            />
            <span className={`truncate ${p.deltaCents != null ? "" : "text-muted-foreground"}`}>
              {p.name}
            </span>
            <span className="text-muted-foreground ml-auto flex-none">
              {p.deltaCents != null
                ? t("upgradeRowOk")
                : t(`upgradeReason.${p.reason ?? "no-axis"}`)}
            </span>
            <span className="w-16 flex-none text-right tabular-nums">
              {p.deltaCents != null ? fmtCop(p.deltaCents) : t("upgradeRowNa")}
            </span>
          </li>
        ))}
        {rows.length > 8 ? (
          <li className="text-muted-foreground/70 text-xs font-semibold">
            {t("upgradeMissingMore", { n: rows.length - 8 })}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/** The single thing worth doing about the current state, or nothing. */
function Callout({
  axes,
  eligible,
  total,
  covered,
  suggested,
  unknownRefs,
  onUseSuggested,
  onKeepOnlyEligible,
}: {
  axes: number;
  eligible: number;
  total: number;
  covered: number;
  suggested: { fromValueLabel: string; toValueLabel: string; eligibleCount: number } | null;
  unknownRefs: number;
  onUseSuggested: (from: string, to: string) => void;
  onKeepOnlyEligible: () => void;
}) {
  const t = useTranslations("Rewards.benefit");
  if (total === 0) return null;

  if (axes === 0) {
    return (
      <Box tone="danger" text={t("upgradeNoAxes")}>
        <Link href="/products" className="text-xs font-extrabold underline">
          {t("upgradeNoAxesCta")}
        </Link>
      </Box>
    );
  }
  if (eligible === 0) {
    return (
      <Box tone="danger" text={t("upgradeNoneEligible")}>
        {suggested ? (
          <Button
            size="sm"
            className="h-9"
            onClick={() => onUseSuggested(suggested.fromValueLabel, suggested.toValueLabel)}
          >
            {t("upgradeUseSuggested", {
              from: suggested.fromValueLabel,
              to: suggested.toValueLabel,
            })}
          </Button>
        ) : null}
      </Box>
    );
  }
  if (covered < total) {
    return (
      <Box tone="warn" text={t("upgradePartial", { out: total - covered, total })}>
        <Button variant="outline" size="sm" className="h-9" onClick={onKeepOnlyEligible}>
          {t("upgradeKeepOnlyEligible")}
        </Button>
      </Box>
    );
  }
  if (unknownRefs > 0) {
    return <Box tone="warn" text={t("upgradeUnknownRefs", { n: unknownRefs })} />;
  }
  return null;
}

function Box({
  tone,
  text,
  children,
}: {
  tone: "warn" | "danger";
  text: string;
  children?: React.ReactNode;
}) {
  const cls =
    tone === "danger"
      ? "border-destructive/30 bg-destructive/5 text-destructive"
      : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400";
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-xl border px-3.5 py-2.5 ${cls}`}>
      <p className="min-w-0 flex-1 text-xs font-semibold">{text}</p>
      {children}
    </div>
  );
}

function AxisEditor({
  value,
  axes,
  onChange,
}: {
  value: Value;
  axes: { optionName: string; values: { label: string }[] }[];
  onChange: (next: Value) => void;
}) {
  const t = useTranslations("Rewards.benefit");
  const labels =
    axes.find((a) => a.optionName === value.optionName)?.values.map((v) => v.label) ?? [];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={value.optionName || undefined}
        onValueChange={(v) =>
          v && onChange({ ...value, optionName: v, fromValueLabel: "", toValueLabel: "" })
        }
      >
        <SelectTrigger className="h-10 w-36">
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
      <Select
        value={value.fromValueLabel || undefined}
        onValueChange={(v) => v && onChange({ ...value, fromValueLabel: v })}
      >
        <SelectTrigger className="h-10 w-32">
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
      <span className="text-muted-foreground text-xs font-semibold">→</span>
      <Select
        value={value.toValueLabel || undefined}
        onValueChange={(v) => v && onChange({ ...value, toValueLabel: v })}
      >
        <SelectTrigger className="h-10 w-32">
          <SelectValue placeholder={t("upgradePickTo")} />
        </SelectTrigger>
        <SelectContent>
          {labels
            .filter((l) => l !== value.fromValueLabel)
            .map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}
