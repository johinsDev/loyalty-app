"use client";

import type { AppRouter } from "@loyalty/api";
import {
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { Gift, Store, Tag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFadeUp } from "@/lib/animate";
import { useTRPC } from "@/lib/trpc/client";

import { CATALOG_STALE_MS } from "../catalog-cache";

type StaffPromo = inferRouterOutputs<AppRouter>["promociones"]["staffCatalog"][number];
type StaffReward = inferRouterOutputs<AppRouter>["rewards"]["staffCatalog"][number];

type Detail = {
  name: string;
  description: string | null;
  storeSpecific: boolean;
  exclusive?: boolean;
};

/**
 * Premios tab — the live catalog for the cashier: active promos + the reward
 * catalog, each tagged org-wide vs store-specific (and exclusive promos). Read-
 * only reference wired to `promociones.staffCatalog` / `rewards.staffCatalog`.
 */
export function RewardsView() {
  const t = useTranslations("Cashier");
  const fade = useFadeUp();
  const trpc = useTRPC();
  const [selected, setSelected] = useState<Detail | null>(null);

  const promos = useQuery(
    trpc.promociones.staffCatalog.queryOptions(undefined, { staleTime: CATALOG_STALE_MS }),
  );
  const rewards = useQuery(
    trpc.rewards.staffCatalog.queryOptions(undefined, { staleTime: CATALOG_STALE_MS }),
  );

  const rewardCost = (r: StaffReward): string => {
    const parts: string[] = [];
    if (r.stampsRequired != null) parts.push(t("costStamps", { count: r.stampsRequired }));
    if (r.pointsCost != null) parts.push(t("earnPoints", { points: r.pointsCost }));
    return parts.join(r.costMode === "and" ? " + " : " / ") || t("rewardFree");
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-5 lg:max-w-4xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{t("tabRewards")}</h1>

      <Section title={t("promosActive")}>
        {promos.isPending ? (
          <p className="text-muted-foreground text-sm">{t("searching")}</p>
        ) : (promos.data?.length ?? 0) === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noPromos")}</p>
        ) : (
          promos.data?.map((p: StaffPromo, i) => (
            <Item
              key={p.id}
              icon={<Tag className="size-5" />}
              name={p.name}
              meta={p.benefitSummary ?? p.shortDescription ?? ""}
              storeSpecific={(p.storeIds?.length ?? 0) > 0}
              exclusive={p.exclusive}
              t={t}
              style={fade(i)}
              onClick={() =>
                setSelected({
                  name: p.name,
                  description: p.shortDescription ?? p.benefitSummary,
                  storeSpecific: (p.storeIds?.length ?? 0) > 0,
                  exclusive: p.exclusive,
                })
              }
            />
          ))
        )}
      </Section>

      <Section title={t("rewardsClaimable")}>
        {rewards.isPending ? (
          <p className="text-muted-foreground text-sm">{t("searching")}</p>
        ) : (rewards.data?.length ?? 0) === 0 ? (
          <p className="text-muted-foreground text-sm">{t("rewardsEmpty")}</p>
        ) : (
          rewards.data?.map((r: StaffReward, i) => (
            <Item
              key={r.id}
              icon={<Gift className="size-5" />}
              name={r.name}
              meta={rewardCost(r)}
              storeSpecific={(r.storeIds?.length ?? 0) > 0}
              t={t}
              style={fade(i)}
              onClick={() =>
                setSelected({
                  name: r.name,
                  description: r.benefitSummary,
                  storeSpecific: (r.storeIds?.length ?? 0) > 0,
                })
              }
            />
          ))
        )}
      </Section>

      <ResponsiveModal open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          {selected ? (
            <div className="flex flex-col px-6 pt-2 pb-6">
              <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
                {selected.name}
              </ResponsiveModalTitle>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StoreBadge specific={selected.storeSpecific} t={t} />
                {selected.exclusive ? (
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-extrabold text-amber-600">
                    {t("promoExclusiveBadge")}
                  </span>
                ) : null}
              </div>
              {selected.description ? (
                <ResponsiveModalDescription className="text-foreground mt-3 text-sm leading-relaxed">
                  {selected.description}
                </ResponsiveModalDescription>
              ) : null}
              <ResponsiveModalClose
                variant="secondary"
                className="mt-6 h-14 w-full rounded-2xl text-base"
              >
                {t("close")}
              </ResponsiveModalClose>
            </div>
          ) : null}
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}

function StoreBadge({
  specific,
  t,
}: {
  specific: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold ${specific ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
    >
      <Store className="size-3" />
      {specific ? t("scopeStoreSpecific") : t("scopeAllStores")}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="text-muted-foreground/70 mb-2.5 text-xs font-extrabold tracking-wider">
        {title}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Item({
  icon,
  name,
  meta,
  storeSpecific,
  exclusive,
  t,
  style,
  onClick,
}: {
  icon: React.ReactNode;
  name: string;
  meta: string;
  storeSpecific: boolean;
  exclusive?: boolean;
  t: ReturnType<typeof useTranslations>;
  style?: React.CSSProperties;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className="border-border bg-card flex items-center gap-3 rounded-2xl border p-3.5 text-left shadow-sm transition-transform active:scale-[0.99]"
    >
      <span className="bg-muted text-muted-foreground grid size-11 flex-none place-items-center rounded-xl">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{name}</div>
        {meta ? (
          <div className="text-muted-foreground/70 truncate text-xs font-semibold">{meta}</div>
        ) : null}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <StoreBadge specific={storeSpecific} t={t} />
          {exclusive ? (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold text-amber-600">
              {t("promoExclusiveBadge")}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
