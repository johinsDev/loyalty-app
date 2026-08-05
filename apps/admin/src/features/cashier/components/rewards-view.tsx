"use client";

import type { AppRouter } from "@loyalty/api";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { Gift, Store, Tag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFadeUp } from "@/lib/animate";
import { useTRPC } from "@/lib/trpc/client";

import { CATALOG_STALE_MS } from "../catalog-cache";

import {
  CashierBadge,
  CashierEmpty,
  CashierListSkeleton,
  CashierMedia,
  CashierPage,
  CashierRow,
  CashierSection,
} from "./chrome";
import { CashierDetailSheet, type CashierDetail } from "./detail-sheet";

type StaffPromo = inferRouterOutputs<AppRouter>["promociones"]["staffCatalog"][number];
type StaffReward = inferRouterOutputs<AppRouter>["rewards"]["staffCatalog"][number];

/**
 * Premios tab — the live catalog for the cashier: active promos + the reward
 * catalog, each tagged org-wide vs store-specific (and exclusive promos).
 * Read-only reference wired to `promociones.staffCatalog` /
 * `rewards.staffCatalog`.
 *
 * Details open through the same `CashierDetailSheet` the register uses. This
 * tab used to build its own modal from a stripped-down object that kept only
 * the name, a description and two badges — so a reward browsed here hid the
 * very cost its own list row was printing one tap earlier, and a promo read
 * differently depending on whether the cashier was mid-sale.
 */
export function RewardsView() {
  const t = useTranslations("Cashier");
  const fade = useFadeUp();
  const trpc = useTRPC();
  const [detail, setDetail] = useState<CashierDetail | null>(null);

  const promos = useQuery(
    trpc.promociones.staffCatalog.queryOptions(undefined, { staleTime: CATALOG_STALE_MS }),
  );
  const rewards = useQuery(
    trpc.rewards.staffCatalog.queryOptions(undefined, { staleTime: CATALOG_STALE_MS }),
  );

  /** "9 sellos", "150 puntos", or both joined the way the reward is paid. */
  const rewardCost = (r: StaffReward): string => {
    const parts: string[] = [];
    if (r.stampsRequired != null) parts.push(t("costStamps", { count: r.stampsRequired }));
    if (r.pointsCost != null) parts.push(t("earnPoints", { points: r.pointsCost }));
    return parts.join(r.costMode === "and" ? " + " : " / ") || t("rewardFree");
  };

  const scopeBadge = (storeSpecific: boolean) => (
    <CashierBadge tone={storeSpecific ? "primary" : "neutral"} icon={<Store className="size-3" />}>
      {storeSpecific ? t("scopeStoreSpecific") : t("scopeAllStores")}
    </CashierBadge>
  );

  return (
    <CashierPage title={t("tabRewards")}>
      <CashierSection icon={<Tag className="size-3.5" />} label={t("promosActive")}>
        {promos.isPending ? (
          <CashierListSkeleton count={4} grid />
        ) : (promos.data?.length ?? 0) === 0 ? (
          // Not `noPromos` — that one says "none apply to this cart", which is
          // the register's sentence; this tab lists the org's promos, cart or no
          // cart.
          <CashierEmpty icon={<Tag className="size-6" />} title={t("promosEmpty")} />
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {promos.data?.map((p: StaffPromo, i) => {
              const storeSpecific = (p.storeIds?.length ?? 0) > 0;
              return (
                <CashierRow
                  key={p.id}
                  style={fade(i)}
                  // A promo carries its own image and background from the
                  // wizard; the tab used to flatten every one of them into the
                  // same grey square with a generic tag in it.
                  media={
                    <CashierMedia
                      url={p.mainImageUrl}
                      background={p.backgroundCss}
                      icon={<Tag className="size-5" />}
                    />
                  }
                  title={p.name}
                  meta={p.benefitSummary ?? p.shortDescription ?? ""}
                  badges={
                    <>
                      {scopeBadge(storeSpecific)}
                      {p.exclusive ? (
                        <CashierBadge tone="warning">{t("promoExclusiveBadge")}</CashierBadge>
                      ) : null}
                    </>
                  }
                  onClick={() =>
                    setDetail({
                      title: p.name,
                      benefit: p.benefitSummary,
                      lines: [p.shortDescription, p.badgeLabel].filter(
                        (l): l is string => Boolean(l),
                      ),
                      warning: p.exclusive ? t("promoExclusiveHint") : null,
                    })
                  }
                />
              );
            })}
          </div>
        )}
      </CashierSection>

      <CashierSection icon={<Gift className="size-3.5" />} label={t("rewardsClaimable")}>
        {rewards.isPending ? (
          <CashierListSkeleton count={4} grid />
        ) : (rewards.data?.length ?? 0) === 0 ? (
          <CashierEmpty icon={<Gift className="size-6" />} title={t("rewardsEmpty")} />
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {rewards.data?.map((r: StaffReward, i) => {
              const storeSpecific = (r.storeIds?.length ?? 0) > 0;
              return (
                <CashierRow
                  key={r.id}
                  style={fade(i)}
                  media={<CashierMedia icon={<Gift className="size-5" />} />}
                  title={r.name}
                  meta={rewardCost(r)}
                  badges={scopeBadge(storeSpecific)}
                  onClick={() =>
                    setDetail({
                      title: r.name,
                      benefit: r.benefitSummary,
                      // The cost was the one thing the old sheet dropped, and
                      // it's the first thing a customer asks about.
                      cost: rewardCost(r),
                      lines: r.description ? [r.description] : [],
                      scope: r.scopeNames,
                      note: r.fulfillmentNote,
                    })
                  }
                />
              );
            })}
          </div>
        )}
      </CashierSection>

      {/* No `onScopeClick`: this tab has no cart to add the qualifying product
          to, so the scope chips stay labels. */}
      <CashierDetailSheet detail={detail} onClose={() => setDetail(null)} />
    </CashierPage>
  );
}
