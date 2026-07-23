"use client";

import { Button, NumberInput, Skeleton, Switch } from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

type Policy = { tierStacksWithPromo: boolean; rewardStacksWithPromo: boolean; maxTotalDiscountPct: number };

/**
 * Lealtad → Stacking: how the register combines the three discount layers
 * (reward · promo · tier %). The order is always reward → promo → tier; these
 * toggle which layers may co-apply, plus a max total-discount cap. Enforced by
 * the checkout money engine.
 */
export function StackingSection() {
  const t = useTranslations("Settings");
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { data } = useQuery(trpc.settings.loyaltyConfigAdmin.queryOptions());
  const [draft, setDraft] = useState<Policy | null>(null);

  // Seed once from the server config.
  useEffect(() => {
    if (data && draft === null) setDraft({ ...data.stacking });
  }, [data, draft]);

  const save = useMutation(
    trpc.settings.updateStackingPolicy.mutationOptions({
      onSuccess: async () => {
        await qc.invalidateQueries(trpc.settings.loyaltyConfigAdmin.queryFilter());
        toast.success(t("saved"));
      },
      onError: () => toast.error(t("stacking.error")),
    }),
  );

  if (!draft) return <Skeleton className="h-64 w-full rounded-2xl" />;

  const set = (patch: Partial<Policy>) => setDraft((d) => ({ ...d!, ...patch }));

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">{t("stacking.title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("stacking.desc")}</p>
      </div>

      <div className="space-y-3">
        <ToggleRow
          label={t("stacking.tierWithPromo")}
          hint={t("stacking.tierWithPromoHint")}
          checked={draft.tierStacksWithPromo}
          onChange={(v) => set({ tierStacksWithPromo: v })}
        />
        <ToggleRow
          label={t("stacking.rewardWithPromo")}
          hint={t("stacking.rewardWithPromoHint")}
          checked={draft.rewardStacksWithPromo}
          onChange={(v) => set({ rewardStacksWithPromo: v })}
        />
        <div className="border-border flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
          <div>
            <span className="text-sm font-bold">{t("stacking.maxCap")}</span>
            <p className="text-muted-foreground mt-0.5 text-xs">{t("stacking.maxCapHint")}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <NumberInput
              value={draft.maxTotalDiscountPct}
              onValueChange={(v) => set({ maxTotalDiscountPct: Math.min(100, Math.max(0, Math.round(v ?? 100))) })}
              className="h-10 w-24"
            />
            <span className="text-sm font-semibold">%</span>
          </div>
        </div>
      </div>

      <Button
        onClick={() => save.mutate(draft)}
        disabled={save.isPending}
        className="h-10 rounded-xl px-6 font-semibold"
      >
        {t("save")}
      </Button>
    </section>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="border-border flex items-center justify-between gap-4 rounded-2xl border p-4">
      <div>
        <span className="text-sm font-bold">{label}</span>
        <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
