"use client";

import { useSession } from "@loyalty/auth/client";
import {
  Button,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Ticket, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

import { useActiveClaimCode } from "../hooks/use-active-claim-code";
import { useClaimCountdown } from "../hooks/use-claim-countdown";

/**
 * Renders the persistent active-claim-code surfaces: a subtle bottom pill shown
 * over any screen whenever the customer holds an active code, and the code sheet
 * itself (re-viewable). Both read the shared `useActiveClaimCode` store, so the
 * code survives closing the sheet. Mounted once alongside `RealtimeNotifications`.
 *
 * `sheetOpen` is controlled by the parent so the realtime listener can pop the
 * sheet open on a fresh code, while "Cerrar" only hides the sheet (keeping the
 * pill) and "Ver código" reopens it.
 */
export function ActiveClaimCode({
  sheetOpen,
  onSheetOpenChange,
}: {
  sheetOpen: boolean;
  onSheetOpenChange: (open: boolean) => void;
}) {
  const tr = useTranslations("Rewards");
  const trpc = useTRPC();
  const active = useActiveClaimCode((s) => s.active);
  const setActive = useActiveClaimCode((s) => s.set);
  const setCurrency = useActiveClaimCode((s) => s.setCurrency);
  const clear = useActiveClaimCode((s) => s.clear);
  const { data: session } = useSession();

  // Rehydrate from the server after a reload: the realtime `reward.claim-code`
  // event won't re-fire, so the in-memory store is empty even though the code is
  // still valid server-side. Only query while the store is empty (a live event
  // takes precedence) and the customer is authenticated.
  const isAuthed = Boolean(session?.user?.id);
  const { data: serverActive } = useQuery({
    ...trpc.rewards.myActiveClaim.queryOptions(),
    enabled: isAuthed && active === null,
  });

  useEffect(() => {
    // Guard against clobbering a fresher live value (`active` flipped non-null
    // between the query firing and resolving). Skip an already-expired code so a
    // stale server read never shows a dead banner.
    if (active !== null || !serverActive) return;
    if (new Date(serverActive.expiresAt).getTime() <= Date.now()) return;
    setActive({
      pendingId: serverActive.pendingId,
      code: serverActive.code,
      rewardName: serverActive.rewardName,
      cost: serverActive.cost,
      expiresAt: serverActive.expiresAt,
      kind: serverActive.kind,
      affordableWith: serverActive.affordableWith,
      currency: serverActive.currency,
    });
  }, [active, serverActive, setActive]);

  // Auto-clear when the countdown hits zero (kept here, not in each surface, so
  // it fires whether or not the sheet is open).
  const { label, expired } = useClaimCountdown(active?.expiresAt, clear);

  const cancelReward = useMutation(trpc.rewards.cancelClaim.mutationOptions());
  const cancelStreak = useMutation(trpc.streaks.cancelClaim.mutationOptions());
  const cancelling = cancelReward.isPending || cancelStreak.isPending;

  // OR reward affordable with both currencies → the customer picks which balance
  // to spend, here on their phone (not the cashier). Optimistically reflect the
  // pick; the server records it so `confirmClaimWithCode` deducts the right one.
  const setClaimCurrency = useMutation(
    trpc.rewards.setClaimCurrency.mutationOptions(),
  );
  const canChooseCurrency = (active?.affordableWith?.length ?? 0) > 1;
  const chosenCurrency = active?.currency ?? active?.affordableWith?.[0];

  const pickCurrency = (currency: "stamps" | "points") => {
    if (!active || active.currency === currency) return;
    setCurrency(currency);
    setClaimCurrency.mutate(
      { pendingId: active.pendingId, currency },
      { onError: () => toast.error(tr("claimCurrencyError")) },
    );
  };

  const cancel = () => {
    if (!active) return;
    const mutation = active.kind === "streak" ? cancelStreak : cancelReward;
    mutation.mutate(
      { pendingId: active.pendingId },
      {
        // Clear optimistically — the server publishes `reward.claim-code-cancelled`
        // to any other tabs/devices; here we don't wait for the round-trip.
        onSuccess: () => clear(),
        onError: () => toast.error(tr("claimCodeCancelError")),
      },
    );
    clear();
    onSheetOpenChange(false);
  };

  if (!active || expired) return null;

  return (
    <>
      {/* Persistent pill — fixed above the bottom nav, non-blocking. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md justify-center px-4 md:bottom-6">
        <div className="bg-foreground text-background pointer-events-auto flex w-full items-center gap-3 rounded-2xl px-4 py-3 shadow-lg">
          <Ticket className="size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {active.rewardName
                ? tr("activeCodeBanner", { name: active.rewardName })
                : tr("activeCodeBannerGeneric")}
            </p>
            <p className="text-background/70 text-xs tabular-nums">
              {tr("activeCodeCountdown", { time: label })}
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onSheetOpenChange(true)}
            className="h-9 shrink-0 rounded-xl"
          >
            {tr("activeCodeView")}
          </Button>
          <button
            type="button"
            onClick={cancel}
            disabled={cancelling}
            aria-label={tr("claimCodeCancel")}
            className="text-background/70 hover:text-background shrink-0 transition-colors disabled:opacity-50"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      {/* The code sheet — re-viewable; "Cerrar" keeps the active-code state. */}
      <ResponsiveModal
        open={sheetOpen}
        onOpenChange={(open) => onSheetOpenChange(open)}
      >
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-sm">
          <div className="flex flex-col items-center gap-3 px-6 pt-2 pb-6 text-center">
            <span className="text-5xl">🎟️</span>
            <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
              {tr("claimCodeTitle")}
            </ResponsiveModalTitle>
            {active.rewardName ? (
              <ResponsiveModalDescription className="text-muted-foreground text-sm">
                {tr("claimCodeReward", { name: active.rewardName })}
              </ResponsiveModalDescription>
            ) : (
              <ResponsiveModalDescription className="text-muted-foreground text-sm">
                {tr("claimCodeHint")}
              </ResponsiveModalDescription>
            )}
            <div className="bg-muted my-2 grid w-full place-items-center rounded-2xl py-5">
              <span className="font-display text-foreground text-5xl font-semibold tracking-[0.4em] tabular-nums">
                {active.code}
              </span>
            </div>

            {/* OR reward affordable with both → let the customer choose which
                balance to spend. The pick is sent to the server (the cashier
                no longer decides) and shown as "Pagás con: …". */}
            {canChooseCurrency ? (
              <div className="w-full">
                <p className="text-muted-foreground mb-1.5 text-xs font-semibold">
                  {tr("claimCurrencyChoose")}
                </p>
                <div className="flex gap-2">
                  {active.affordableWith?.map((c) => {
                    const selected = chosenCurrency === c;
                    const amount =
                      c === "stamps"
                        ? (active.cost?.stamps ?? 0)
                        : (active.cost?.points ?? 0);
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => pickCurrency(c)}
                        className={`h-11 flex-1 rounded-xl border text-sm font-bold transition-colors ${
                          selected
                            ? "bg-foreground text-background border-foreground"
                            : "bg-card text-muted-foreground border-border"
                        }`}
                      >
                        {c === "stamps"
                          ? tr("payStamps", { count: amount })
                          : tr("payPoints", { count: amount })}
                      </button>
                    );
                  })}
                </div>
                {chosenCurrency ? (
                  <p className="text-muted-foreground mt-2 text-xs font-semibold">
                    {chosenCurrency === "stamps"
                      ? tr("claimPayingStamps")
                      : tr("claimPayingPoints")}
                  </p>
                ) : null}
              </div>
            ) : null}

            <p className="text-muted-foreground text-xs tabular-nums">
              {tr("activeCodeExpiresIn", { time: label })}
            </p>
            <Button
              onClick={() => onSheetOpenChange(false)}
              className="mt-2 h-12 w-full rounded-2xl font-semibold"
            >
              {tr("close")}
            </Button>
            <Button
              variant="ghost"
              onClick={cancel}
              disabled={cancelling}
              className="text-muted-foreground h-11 w-full rounded-2xl font-medium"
            >
              {tr("claimCodeCancel")}
            </Button>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}
