"use client";

import type { AppRouter } from "@loyalty/api";
import { Button } from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { ArrowLeft, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

import { CATALOG_STALE_MS } from "../catalog-cache";

import { IdentifyPane, type IdentifiedCustomer } from "./identify-pane";
import { QrScanner } from "./qr-scanner";
import { RecentMovements } from "./recent-movements";
import { RegisterBoard, type PreselectReward } from "./register-board";

type CustomerHit = IdentifiedCustomer;

type WalletView = inferRouterOutputs<AppRouter>["stamps"]["walletForCustomer"];
/** A resolved reward claim (scan): identifies the customer + reward so the
 *  register can open with it preselected. Redemption happens in recordPurchase. */
type ResolveClaim = inferRouterOutputs<AppRouter>["rewards"]["resolveClaim"];

type Step = "identify" | "found" | "purchase-success" | "scan" | "claim-success";

/** QR prefixes the customer app renders for single-use claim tokens. */
const REWARD_PREFIX = "T4P|"; // stamps/points reward
const STREAK_PREFIX = "T4S|"; // streak reward

/**
 * Escanear tab — the register. Identify a socio (phone lookup / QR), then the
 * three-column RegisterBoard (customer intelligence · catalog · dark cart) to
 * build + record the sale. Scanning a reward QR resolves it into the register
 * with the reward preselected; a streak QR (`T4S|`) claims standalone.
 */
export function ScanView() {
  const t = useTranslations("Cashier");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Shift prefetch: warm the store catalog on entering the register so the first
  // product search + picker are instant (long staleTime).
  useEffect(() => {
    void queryClient.prefetchQuery(
      trpc.menu.list.queryOptions({ pageSize: 20 }, { staleTime: CATALOG_STALE_MS }),
    );
  }, [queryClient, trpc]);

  const [step, setStep] = useState<Step>("identify");
  const [selected, setSelected] = useState<CustomerHit | null>(null);
  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [pastedCode, setPastedCode] = useState("");
  // A reward resolved from a scan, preselected into the register.
  const [preselectReward, setPreselectReward] = useState<PreselectReward | null>(null);

  // Staff-safe CRM detail for the selected customer — powers the board's left
  // intelligence column.
  const registerCtx = useQuery(
    trpc.customers.registerContext.queryOptions(
      { customerId: selected?.id ?? "" },
      { enabled: step === "found" && Boolean(selected) },
    ),
  );

  // Rewards this socio can redeem right now — offered inline in the board's cart.
  const available = useQuery(
    trpc.rewards.availableForCustomer.queryOptions(
      { customerId: selected?.id ?? "" },
      { enabled: step === "found" && Boolean(selected) },
    ),
  );

  // Reward resolve (identify only; the sale's recordPurchase does the deduction);
  // a streak QR claims standalone.
  const resolveClaim = useMutation(trpc.rewards.resolveClaim.mutationOptions());
  const claimStreak = useMutation(trpc.streaks.claimReward.mutationOptions());
  const isClaiming = resolveClaim.isPending || claimStreak.isPending;

  const reset = () => {
    setStep("identify");
    setSelected(null);
    setWallet(null);
    setPreselectReward(null);
    setPastedCode("");
  };

  // A resolved reward routes into the register with the reward preselected. When
  // scanned before identifying, adopt the customer from the claim + load their
  // wallet; the board fills name/phone from registerContext.
  const openRegisterWithReward = async (resolved: ResolveClaim) => {
    if (!selected || !wallet) {
      try {
        const view = await queryClient.fetchQuery(
          trpc.stamps.walletForCustomer.queryOptions({ customerId: resolved.customerId }),
        );
        setSelected({ id: resolved.customerId, name: null, phone: "" });
        setWallet(view ?? null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("walletError"));
        return;
      }
    }
    setPreselectReward({
      rewardId: resolved.reward.id,
      currency: resolved.currency,
      name: resolved.reward.name,
      note: resolved.reward.fulfillmentNote,
    });
    setStep("found");
    toast.success(t("rewardResolvedToast"));
  };

  const selectCustomer = async (hit: CustomerHit) => {
    setSelected(hit);
    try {
      // Fetch with the just-picked id directly — a refetch() would reuse the
      // query's stale input (the component hasn't re-rendered yet).
      const view = await queryClient.fetchQuery(
        trpc.stamps.walletForCustomer.queryOptions({ customerId: hit.id }),
      );
      setWallet(view ?? null);
      setStep("found");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("walletError"));
    }
  };

  const onScanResult = useCallback(
    async (text: string) => {
      const isStreak = text.startsWith(STREAK_PREFIX);
      const isReward = text.startsWith(REWARD_PREFIX);
      if (!isStreak && !isReward) {
        toast.error(t("notRewardCode"));
        return;
      }
      const token = text.slice(REWARD_PREFIX.length); // both prefixes are 4 chars
      try {
        if (isStreak) {
          await claimStreak.mutateAsync({ token });
          setStep("claim-success");
          toast.success(t("claimValidated"));
        } else {
          const resolved = await resolveClaim.mutateAsync({ token });
          await openRegisterWithReward(resolved);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg === "ALREADY_CLAIMED") toast.error(t("alreadyClaimed"));
        else if (msg === "INSUFFICIENT_BALANCE") toast.error(t("insufficientBalance"));
        else toast.error(t("invalidToken"));
      }
    },
    [claimStreak, resolveClaim, openRegisterWithReward, t],
  );

  const customerName = (hit: CustomerHit | null) =>
    hit?.name?.trim() || hit?.phone || t("unknownCustomer");

  // Identify (two-pane) and the register board need the wide canvas; the linear
  // success/scan steps stay narrow and centered.
  const wide = step === "identify" || step === "found";

  return (
    <div
      className={`mx-auto w-full px-5 py-5 ${wide ? "max-w-2xl lg:max-w-6xl" : "max-w-2xl lg:max-w-4xl"}`}
    >
      {/* Identify — identify pane + live recent-movements panel (T4 Caja). */}
      {step === "identify" && (
        <div className="lg:grid lg:grid-cols-[1fr_minmax(300px,360px)] lg:items-start lg:gap-5">
          <IdentifyPane
            onSelect={(hit) => void selectCustomer(hit)}
            onScan={() => setStep("scan")}
          />
          <div className="mt-5 lg:mt-0">
            <RecentMovements />
          </div>
        </div>
      )}

      {step === "found" && selected && wallet && (
        <RegisterBoard
          customerId={selected.id}
          customerName={customerName(selected)}
          register={registerCtx.data}
          wallet={wallet}
          availableRewards={available.data ?? []}
          preselect={preselectReward ?? undefined}
          onSuccess={(view) => {
            setWallet(view);
            setPreselectReward(null);
            setStep("purchase-success");
          }}
          onRewardPending={() => setStep("scan")}
          onCancel={reset}
          onScan={() => setStep("scan")}
        />
      )}

      {step === "purchase-success" && selected && wallet && (
        <div className="flex flex-col items-center gap-3.5 py-10 text-center">
          <div className="from-primary to-primary/80 grid size-24 place-items-center rounded-3xl bg-gradient-to-br text-white shadow-xl">
            <Check className="size-12" strokeWidth={3} />
          </div>
          <div className="font-display text-3xl font-semibold tracking-tight">
            {t("purchaseRecorded")}
          </div>
          <div className="text-muted-foreground text-base">
            {t("forCustomer")} <strong className="text-foreground">{customerName(selected)}</strong>
          </div>
          <div className="bg-card border-border mt-1 rounded-2xl border p-4">
            <div className="text-muted-foreground/70 text-[0.6875rem] font-extrabold tracking-wider">
              {t("newBalance")}
            </div>
            <div className="text-lg font-extrabold">
              {wallet.currentStamps}/{wallet.walletSize} {t("stampMany")}
            </div>
          </div>
          <Button
            size="lg"
            onClick={reset}
            className="mt-3 h-10 w-full max-w-xs rounded-2xl text-base font-extrabold"
          >
            {t("nextMember")}
          </Button>
        </div>
      )}

      {step === "scan" && (
        <div className="bg-card border-border mx-auto max-w-md rounded-3xl border p-6 shadow-sm">
          <button
            type="button"
            onClick={() => (selected ? setStep("found") : reset())}
            className="text-muted-foreground mb-3.5 flex items-center gap-1 text-sm font-bold"
          >
            <ArrowLeft className="size-4" />
            {t("back")}
          </button>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t("scanRedeemTitle")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("scanRedeemHint")}</p>
          <QrScanner
            caption={t("aimCameraReward")}
            permissionError={t("cameraError")}
            onResult={(text) => void onScanResult(text)}
          />
          {isClaiming ? (
            <div className="text-muted-foreground text-center text-sm font-semibold">
              {t("validating")}
            </div>
          ) : null}

          {/* Camera-free fallback: paste the customer's code. */}
          <div className="border-border mt-4 border-t pt-4">
            <label className="text-muted-foreground/70 mb-1.5 block text-[0.6875rem] font-extrabold tracking-wider">
              {t("pasteCodeLabel")}
            </label>
            <div className="flex gap-2">
              <input
                value={pastedCode}
                onChange={(e) => setPastedCode(e.target.value)}
                placeholder={t("pasteCodePlaceholder")}
                className="border-border bg-muted placeholder:text-muted-foreground/70 h-10 w-full rounded-2xl border px-3.5 text-sm font-semibold outline-none"
              />
              <Button
                size="lg"
                disabled={pastedCode.trim().length === 0 || isClaiming}
                onClick={() => void onScanResult(pastedCode.trim())}
                className="h-10 flex-none rounded-2xl px-4 font-extrabold"
              >
                {t("pasteCodeCta")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === "claim-success" && (
        <div className="flex flex-col items-center gap-3.5 py-10 text-center">
          <div className="from-primary to-primary/80 grid size-24 place-items-center rounded-3xl bg-gradient-to-br text-white shadow-xl">
            <Check className="size-12" strokeWidth={3} />
          </div>
          <div className="font-display text-3xl font-semibold tracking-tight">
            {t("claimValidated")}
          </div>
          <div className="text-muted-foreground text-base">{t("handRewardToCustomer")}</div>
          <Button
            size="lg"
            onClick={reset}
            className="mt-3 h-10 w-full max-w-xs rounded-2xl text-base font-extrabold"
          >
            {t("done")}
          </Button>
        </div>
      )}
    </div>
  );
}
