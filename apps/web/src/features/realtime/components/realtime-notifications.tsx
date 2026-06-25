"use client";

import { useSession } from "@loyalty/auth/client";
import {
  Button,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { StreakClaimCelebration } from "@/features/home/components/streak-claim-celebration";
import {
  type CelebratedTier,
  TierCelebration,
} from "@/features/home/components/tier-celebration";
import { useQrDrawer } from "@/features/qr/hooks/use-qr-drawer";
import { ActiveClaimCode } from "@/features/rewards/components/active-claim-code";
import { useActiveClaimCode } from "@/features/rewards/hooks/use-active-claim-code";
import { Celebrate } from "@/lib/celebrate";
import { useTRPC } from "@/lib/trpc/client";

import { useCustomerRoom } from "../hooks/use-customer-room";

interface Props {
  /** PartyKit host from `NEXT_PUBLIC_PARTYKIT_HOST`. */
  host: string | undefined;
}

type Celebration = { title: string; body?: string };

/**
 * App-wide live notifications listener (mounted once in the locale layout).
 * Subscribes to the logged-in customer's room and, on a `notification` realtime
 * event, refreshes the in-app feed. A `first-purchase` event gets a celebratory
 * modal + confetti (a warmer welcome than a toast); everything else is a plain
 * informational toast.
 */
export function RealtimeNotifications({ host }: Props) {
  const t = useTranslations("Notifications");
  const tr = useTranslations("Rewards");
  const tc = useTranslations("Card");
  const th = useTranslations("Home");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const closeQr = useQrDrawer((s) => s.setOpen);
  const { data: session } = useSession();
  const customerId = session?.user?.id ?? null;
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [tierCelebration, setTierCelebration] = useState<CelebratedTier | null>(
    null,
  );
  const [streakClaimed, setStreakClaimed] = useState(false);
  const setActiveClaim = useActiveClaimCode((s) => s.set);
  const clearActiveClaim = useActiveClaimCode((s) => s.clear);
  const [codeSheetOpen, setCodeSheetOpen] = useState(false);

  // Re-fetch every rewards surface (catalog, detail, recent, levels) after a
  // claim / unlock so statuses + balances flip live.
  const invalidateRewards = () => {
    void queryClient.invalidateQueries(trpc.rewards.pathFilter());
    void queryClient.invalidateQueries(trpc.stamps.myWallet.queryFilter());
    void queryClient.invalidateQueries(trpc.points.pathFilter());
  };

  // Refresh the sellos surfaces (the home stamp card re-renders off these).
  const invalidateStamps = () => {
    void queryClient.invalidateQueries(trpc.stamps.myWallet.queryFilter());
    void queryClient.invalidateQueries(trpc.stamps.myHistory.queryFilter());
  };

  // Refresh the points surfaces (the home points ring re-renders off these).
  const invalidatePoints = () => {
    void queryClient.invalidateQueries(trpc.points.mySummary.queryFilter());
    void queryClient.invalidateQueries(trpc.points.myHistory.queryFilter());
    void queryClient.invalidateQueries(trpc.points.myTransactions.queryFilter());
  };

  // Refresh the streak surfaces (the home streak card re-renders off these).
  const invalidateStreaks = () => {
    void queryClient.invalidateQueries(trpc.streaks.myStreak.queryFilter());
    void queryClient.invalidateQueries(trpc.streaks.myHistory.queryFilter());
  };

  useCustomerRoom({
    customerId,
    host,
    onEvent: (event) => {
      if (event.event === "reward.claim-code") {
        // No-scanner path: the cashier requested a claim — persist the code in
        // the active-claim store (so it survives closing the sheet) and pop the
        // sheet open with the big code to read aloud at the register.
        const data = event.data as {
          kind?: "reward" | "streak";
          pendingId?: string;
          code?: string;
          rewardName?: string;
          cost?: { stamps?: number; points?: number };
          expiresAt?: string;
          affordableWith?: ("stamps" | "points")[];
          currency?: "stamps" | "points";
        };
        if (data.code && data.pendingId && data.expiresAt) {
          setActiveClaim({
            pendingId: data.pendingId,
            code: data.code,
            rewardName: data.rewardName,
            cost: data.cost,
            expiresAt: data.expiresAt,
            kind: data.kind ?? "reward",
            affordableWith: data.affordableWith,
            currency: data.currency,
          });
          setCodeSheetOpen(true);
        }
        return;
      }

      if (event.event === "reward.claim-code-cancelled") {
        // Cancelled from another tab/device — clear the active code + close the
        // sheet here so every surface stays in sync.
        clearActiveClaim();
        setCodeSheetOpen(false);
        return;
      }

      if (event.event === "reward.claimed") {
        // The cashier confirmed a reward claim — close the QR view + the claim
        // code sheet (if open), clear the active code, refresh rewards +
        // balances, and celebrate.
        const data = event.data as { rewardName?: string };
        closeQr(false);
        clearActiveClaim();
        setCodeSheetOpen(false);
        invalidateRewards();
        setCelebration({
          title: tr("claimedTitle"),
          body: data.rewardName
            ? tr("claimedBody", { name: data.rewardName })
            : undefined,
        });
        return;
      }

      if (event.event === "streak.advanced") {
        // A day lit up — refresh the streak card on any screen.
        invalidateStreaks();
        return;
      }

      if (event.event === "streak.completed") {
        // Streak goal reached — refresh + nudge. The persistent reward banner
        // takes over after; here a transient toast confirms it app-wide.
        invalidateStreaks();
        toast(th("streakCompletedBanner"));
        return;
      }

      if (event.event === "streak.reward.claimed") {
        // The cashier confirmed the streak reward (code or scan path) — clean up
        // the code surfaces, refresh streak + reward state, and play the claim
        // celebration (delayed so the QR drawer can close first).
        closeQr(false);
        clearActiveClaim();
        setCodeSheetOpen(false);
        invalidateRewards();
        invalidateStreaks();
        window.setTimeout(() => setStreakClaimed(true), 1000);
        return;
      }

      if (event.event === "rewards.unlocked") {
        const data = event.data as { tierUp?: { tierName?: string } | null };
        invalidateRewards();
        if (data.tierUp?.tierName) {
          setCelebration({
            title: tr("tierUpTitle"),
            body: tr("tierUpBody", { tier: data.tierUp.tierName }),
          });
        } else {
          toast(tr("unlockedToast"));
        }
        return;
      }

      if (event.event === "stamp.earned") {
        // A purchase earned a stamp — refresh the card (it re-renders off the
        // wallet query) and toast so it's visible on ANY screen, not just home.
        invalidateStamps();
        toast(tc("earnedBanner"));
        return;
      }

      if (event.event === "points.earned") {
        // Points credited from a purchase — refresh the ring/history + toast.
        const data = event.data as { earned?: number };
        invalidatePoints();
        if (data.earned && data.earned > 0) {
          toast(th("pointsEarnedToast", { count: data.earned }));
        }
        return;
      }

      if (event.event === "tier.changed") {
        // Level change — refresh points surfaces; up pops the level-up
        // celebration (tier details ride on the event), down is a brief toast.
        const data = event.data as {
          direction?: "up" | "down";
          tier?: {
            name: string;
            color: string;
            benefits?: string[];
            terms?: string | null;
          };
        };
        invalidatePoints();
        if (data.direction === "up" && data.tier) {
          setTierCelebration({
            name: data.tier.name,
            color: data.tier.color,
            benefits: data.tier.benefits ?? [],
            terms: data.tier.terms ?? null,
          });
        } else if (data.direction === "down" && data.tier) {
          toast(th("tierDownBanner", { tier: data.tier.name }));
        }
        return;
      }

      if (event.event !== "notification") return;
      const data = event.data as {
        type?: string;
        title?: string;
        body?: string;
      };
      void queryClient.invalidateQueries(trpc.notifications.pathFilter());

      if (data.type === "first-purchase") {
        setCelebration({
          title: data.title ?? t("firstPurchaseTitle"),
          body: data.body,
        });
        return;
      }
      toast(data.title ?? t("newNotification"), { description: data.body });
    },
  });

  return (
    <>
      <ResponsiveModal
        open={celebration !== null}
        onOpenChange={(open) => !open && setCelebration(null)}
      >
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-sm">
          {celebration ? (
            <>
              <div className="pointer-events-none fixed inset-0 z-50">
                <Celebrate distance={1000} />
              </div>
              <div className="flex flex-col items-center gap-3 px-6 pt-2 pb-6 text-center">
                <span className="text-6xl">🎉</span>
                <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
                  {celebration.title}
                </ResponsiveModalTitle>
                {celebration.body ? (
                  <ResponsiveModalDescription className="text-muted-foreground text-sm">
                    {celebration.body}
                  </ResponsiveModalDescription>
                ) : null}
                <Button
                  onClick={() => setCelebration(null)}
                  className="mt-3 h-12 w-full rounded-2xl font-semibold"
                >
                  {t("firstPurchaseCta")}
                </Button>
              </div>
            </>
          ) : null}
        </ResponsiveModalContent>
      </ResponsiveModal>

      <TierCelebration
        tier={tierCelebration}
        onClose={() => setTierCelebration(null)}
      />

      <StreakClaimCelebration
        open={streakClaimed}
        onClose={() => setStreakClaimed(false)}
      />

      <ActiveClaimCode
        sheetOpen={codeSheetOpen}
        onSheetOpenChange={setCodeSheetOpen}
      />
    </>
  );
}
