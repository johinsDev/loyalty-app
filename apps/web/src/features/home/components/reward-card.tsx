"use client";

import { Skeleton } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { useTranslations } from "next-intl";

import { useQrDrawer } from "@/features/qr/hooks/use-qr-drawer";
import { autoCurrency } from "@/features/rewards/lib/cost";
import type { RewardListItem } from "@/features/rewards/types";
import { useActiveCustomerStoreId } from "@/features/store/use-active-customer-store";
import { useFadeUp } from "@/lib/animate";
import { useTRPC } from "@/lib/trpc/client";

/**
 * Home "LISTO PARA CANJEAR" card, wired to the real first ready reward
 * (`rewards.list` filtered to "listos", limit 1). Owns its own heading so the
 * whole block (heading + card) collapses when nothing is ready — while loading,
 * it streams a skeleton in the card's place. Tapping it links to the rewards
 * screen where the claim QR is issued. Client component (per-user query).
 */
export function RewardCard() {
  const t = useTranslations("Home");
  const fade = useFadeUp();
  const trpc = useTRPC();

  const storeId = useActiveCustomerStoreId() ?? undefined;
  const { data, isPending } = useQuery(
    trpc.rewards.list.queryOptions({ filter: "listos", limit: 1, storeId }),
  );
  const reward = data?.items[0] ?? null;

  // Loaded with no ready reward → render nothing (heading included), so the
  // "LISTO PARA CANJEAR" block collapses entirely.
  if (!isPending && !reward) return null;

  return (
    <div className="mt-6" style={fade(4)}>
      <p className="text-muted-foreground mb-3 text-xs font-bold tracking-wider">
        {t("readyToClaim")}
      </p>
      {reward ? <ReadyReward reward={reward} /> : <RewardCardSkeleton />}
    </div>
  );
}

function ReadyReward({ reward }: { reward: RewardListItem }) {
  const t = useTranslations("Home");
  const meta = useCostLabel(reward);
  const openClaim = useQrDrawer((s) => s.openClaim);

  // Open the unified QR pre-selected to this reward (no navigation). For an "or"
  // reward affordable with both, default to the first affordable currency; the
  // customer can re-pick inside the drawer.
  const currency =
    autoCurrency(reward) ?? reward.affordableWith[0] ?? "stamps";

  return (
    <button
      type="button"
      onClick={() =>
        openClaim({ kind: "reward", rewardId: reward.id, currency })
      }
      className="bg-card flex w-full items-center gap-3.5 rounded-3xl p-4 text-left shadow-lg shadow-black/5 ring-1 ring-black/5 transition-transform active:scale-[0.99] dark:ring-white/10"
    >
      <span className="bg-primary/10 text-primary grid size-14 flex-none place-items-center overflow-hidden rounded-2xl">
        {reward.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reward.imageUrl} alt="" className="size-full object-cover" />
        ) : (
          <Gift className="size-7" />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-foreground truncate text-base font-bold">
          {reward.name}
        </span>
        <span className="text-muted-foreground text-sm">
          {t("availableNow", { cost: meta })}
        </span>
      </div>
      <span className="bg-primary text-primary-foreground grid h-9 flex-none place-items-center rounded-full px-5 text-sm font-bold">
        {t("redeem")}
      </span>
    </button>
  );
}

/** "5 sellos", "50 pts", or "5 sellos o 50 pts" / "… y …" per costMode. */
function useCostLabel(reward: RewardListItem): string {
  const tr = useTranslations("Rewards");
  const parts: string[] = [];
  if (reward.stampsRequired != null)
    parts.push(tr("costStamps", { count: reward.stampsRequired }));
  if (reward.pointsCost != null)
    parts.push(tr("costPoints", { count: reward.pointsCost }));
  if (parts.length < 2) return parts[0] ?? "";
  return reward.costMode === "and"
    ? tr("costAnd", { a: parts[0]!, b: parts[1]! })
    : tr("costOr", { a: parts[0]!, b: parts[1]! });
}

function RewardCardSkeleton() {
  return (
    <div className="bg-card flex items-center gap-3.5 rounded-3xl p-4 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
      <Skeleton className="size-14 flex-none rounded-2xl" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-9 w-20 rounded-full" />
    </div>
  );
}
