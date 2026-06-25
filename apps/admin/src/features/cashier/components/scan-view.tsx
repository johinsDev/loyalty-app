"use client";

import type { AppRouter } from "@loyalty/api";
import { Button, CurrencyInput } from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useDebounce } from "ahooks";
import { ArrowLeft, Check, Gift, QrCode, Search, User, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { useFadeUp } from "@/lib/animate";
import { useTRPC } from "@/lib/trpc/client";

import { ItemizedPurchase } from "./itemized-purchase";
import { QrScanner } from "./qr-scanner";

type CustomerHit = {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
};

type WalletView = inferRouterOutputs<AppRouter>["stamps"]["walletForCustomer"];

type Step = "identify" | "found" | "purchase-success" | "scan" | "claim-success";

/** QR prefixes the customer app renders for single-use claim tokens. */
const CLAIM_PREFIX = "T4R|"; // stamp wallet reward
const STREAK_PREFIX = "T4S|"; // streak reward

/** A REWARD_PENDING conflict thrown by `stamps.recordPurchase`. */
function isRewardPending(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { message?: string; data?: { code?: string } };
  return e.data?.code === "CONFLICT" && e.message === "REWARD_PENDING";
}

/**
 * Escanear tab — wired to the real ledger backend. Search a socio
 * (`customers.search`), load their wallet (`stamps.walletForCustomer`), and
 * either record a purchase by price (`stamps.recordPurchase`) or scan their
 * reward QR to claim it (`stamps.claim`). When a purchase is blocked by an
 * unclaimed reward (REWARD_PENDING) we flip straight to the scanner.
 */
export function ScanView() {
  const t = useTranslations("Cashier");
  const fade = useFadeUp();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("identify");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CustomerHit | null>(null);
  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [priceCop, setPriceCop] = useState<number | undefined>(undefined);
  const [purchaseMode, setPurchaseMode] = useState<"total" | "items">("total");
  const [pastedCode, setPastedCode] = useState("");

  const debouncedQuery = useDebounce(query.trim(), { wait: 250 });
  const search = useQuery(
    trpc.customers.search.queryOptions(
      { query: debouncedQuery, limit: 10 },
      { enabled: debouncedQuery.length >= 1 },
    ),
  );

  const recordPurchase = useMutation(
    trpc.stamps.recordPurchase.mutationOptions(),
  );
  const claim = useMutation(trpc.stamps.claim.mutationOptions());
  const claimStreak = useMutation(trpc.streaks.claimReward.mutationOptions());
  const isClaiming = claim.isPending || claimStreak.isPending;

  const reset = () => {
    setStep("identify");
    setQuery("");
    setSelected(null);
    setWallet(null);
    setPriceCop(undefined);
  };

  const selectCustomer = async (hit: CustomerHit) => {
    setSelected(hit);
    setPriceCop(undefined);
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

  const onRecordPurchase = async () => {
    if (!selected || priceCop === undefined) return;
    try {
      const view = await recordPurchase.mutateAsync({
        customerId: selected.id,
        priceCents: Math.round(priceCop * 100),
        idempotencyKey: crypto.randomUUID(),
      });
      setWallet(view);
      setStep("purchase-success");
      toast.success(t("purchaseRecorded"));
    } catch (err) {
      if (isRewardPending(err)) {
        toast.error(t("rewardPendingToast"));
        setStep("scan");
        return;
      }
      toast.error(err instanceof Error ? err.message : t("purchaseError"));
    }
  };

  const onScanResult = useCallback(
    async (text: string) => {
      const isStreak = text.startsWith(STREAK_PREFIX);
      const isStamp = text.startsWith(CLAIM_PREFIX);
      if (!isStreak && !isStamp) {
        toast.error(t("notRewardCode"));
        return;
      }
      const token = text.slice(CLAIM_PREFIX.length); // both prefixes are 4 chars
      try {
        if (isStreak) {
          await claimStreak.mutateAsync({ token });
        } else {
          const { newWallet } = await claim.mutateAsync({ token });
          setWallet(newWallet);
        }
        setStep("claim-success");
        toast.success(t("claimValidated"));
      } catch (err) {
        if (err instanceof Error && err.message === "ALREADY_CLAIMED") {
          toast.error(t("alreadyClaimed"));
        } else {
          toast.error(t("invalidToken"));
        }
      }
    },
    [claim, claimStreak, t],
  );

  const customerName = (hit: CustomerHit | null) =>
    hit?.name?.trim() || hit?.phone || t("unknownCustomer");

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-5 lg:max-w-4xl">
      {step === "identify" && (
        <div className="flex flex-col gap-5">
          <div className="bg-card border-border rounded-3xl border p-6 shadow-sm">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {t("identifyTitle")}
            </h1>
            <p className="text-muted-foreground mt-1 mb-4 text-sm">
              {t("searchHint")}
            </p>
            <div className="border-border bg-muted flex h-10 items-center gap-2 rounded-2xl border px-3.5">
              <Search className="text-muted-foreground/70 size-4" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="placeholder:text-muted-foreground/70 w-full bg-transparent text-sm font-semibold outline-none"
              />
            </div>

            {debouncedQuery.length >= 1 ? (
              <div className="mt-4">
                {search.isPending ? (
                  <div className="text-muted-foreground py-6 text-center text-sm font-semibold">
                    {t("searching")}
                  </div>
                ) : search.data && search.data.length > 0 ? (
                  <div className="flex flex-col">
                    {search.data.map((hit, i) => (
                      <button
                        key={hit.id}
                        type="button"
                        style={fade(i)}
                        onClick={() => void selectCustomer(hit)}
                        className="border-border hover:bg-muted flex items-center gap-3 border-b py-3 text-left last:border-0"
                      >
                        <span className="bg-muted text-muted-foreground grid size-10 flex-none place-items-center rounded-xl">
                          <User className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold">
                            {customerName(hit)}
                          </div>
                          <div className="text-muted-foreground/70 truncate text-xs font-semibold">
                            {hit.phone}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground py-6 text-center text-sm font-semibold">
                    {t("noResults")}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {step === "found" && selected && wallet && (
        <div className="flex flex-col gap-5">
          <div className="bg-card border-border rounded-3xl border p-5 shadow-sm">
            <div className="flex items-center gap-3.5">
              <span className="bg-muted text-muted-foreground grid size-14 flex-none place-items-center rounded-full">
                <User className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-extrabold">
                  {customerName(selected)}
                </div>
                <div className="text-muted-foreground text-sm font-semibold">
                  {selected.phone}
                </div>
              </div>
            </div>
            <div className="bg-muted mt-4 rounded-2xl p-3.5">
              <div className="text-muted-foreground/70 text-[0.6875rem] font-extrabold tracking-wider">
                {t("stamps")}
              </div>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="font-display text-2xl font-semibold">
                  {wallet.currentStamps}
                </span>
                <span className="text-muted-foreground/70 text-sm font-bold">
                  / {wallet.walletSize}
                </span>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="border-border bg-card text-muted-foreground hover:text-foreground flex h-10 flex-1 items-center justify-center gap-2 rounded-2xl border text-sm font-bold"
              >
                <X className="size-4" />
                {t("cancelIdentify")}
              </button>
              <button
                type="button"
                onClick={() => setStep("scan")}
                className="border-border bg-card text-muted-foreground hover:text-foreground flex h-10 flex-1 items-center justify-center gap-2 rounded-2xl border text-sm font-bold"
              >
                <QrCode className="size-4" />
                {t("scanRewardCode")}
              </button>
            </div>
          </div>

          {wallet.rewardPending ? (
            <div className="bg-card border-border rounded-3xl border p-6 shadow-sm">
              <div className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold tracking-wide">
                <Gift className="size-4" />
                {t("rewardPendingTag")}
              </div>
              <h2 className="font-display mt-3 text-lg font-semibold">
                {t("rewardPendingTitle")}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {t("rewardPendingHint")}
              </p>
              <Button
                variant="gradient"
                size="lg"
                onClick={() => setStep("scan")}
                className="mt-4 h-10 w-full gap-2 rounded-2xl text-base font-extrabold"
              >
                <QrCode className="size-5" />
                {t("scanQr")}
              </Button>
            </div>
          ) : (
            <div className="bg-card border-border rounded-3xl border p-6 shadow-sm">
              <h2 className="font-display text-lg font-semibold">
                {t("recordPurchaseTitle")}
              </h2>
              <p className="text-muted-foreground mt-1 mb-4 text-sm">
                {t("recordPurchaseHint")}
              </p>

              {/* Total vs itemized (the latter enables promo apply). */}
              <div className="bg-muted mb-4 grid grid-cols-2 gap-1 rounded-2xl p-1">
                {(["total", "items"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPurchaseMode(m)}
                    className={
                      purchaseMode === m
                        ? "bg-card rounded-xl py-2 text-sm font-bold shadow-sm"
                        : "text-muted-foreground rounded-xl py-2 text-sm font-bold"
                    }
                  >
                    {t(m === "total" ? "modeTotal" : "modeItems")}
                  </button>
                ))}
              </div>

              {purchaseMode === "total" ? (
                <>
                  <label className="text-muted-foreground/70 mb-1.5 block text-[0.6875rem] font-extrabold tracking-wider">
                    {t("priceLabel")}
                  </label>
                  <CurrencyInput
                    currency="COP"
                    locale="es-CO"
                    decimalScale={0}
                    value={priceCop}
                    onValueChange={setPriceCop}
                    placeholder={t("pricePlaceholder")}
                    className="h-10"
                  />
                  <Button
                    variant="gradient"
                    size="lg"
                    disabled={priceCop === undefined || recordPurchase.isPending}
                    onClick={() => void onRecordPurchase()}
                    className="mt-4 h-10 w-full gap-2 rounded-2xl text-base font-extrabold"
                  >
                    <Check className="size-5" />
                    {t("recordPurchase")}
                  </Button>
                </>
              ) : (
                <ItemizedPurchase
                  customerId={selected.id}
                  onSuccess={(view) => {
                    setWallet(view);
                    setStep("purchase-success");
                  }}
                  onRewardPending={() => setStep("scan")}
                />
              )}
            </div>
          )}
        </div>
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
            {t("forCustomer")}{" "}
            <strong className="text-foreground">
              {customerName(selected)}
            </strong>
          </div>
          <div className="bg-card border-border mt-1 rounded-2xl border p-4">
            <div className="text-muted-foreground/70 text-[0.6875rem] font-extrabold tracking-wider">
              {t("newBalance")}
            </div>
            <div className="text-lg font-extrabold">
              {wallet.currentStamps}/{wallet.walletSize} {t("stampMany")}
            </div>
          </div>
          {wallet.rewardPending ? (
            <div className="bg-primary/10 text-primary mt-1 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-extrabold">
              🎯 {t("nudgeComplete")}
            </div>
          ) : null}
          <Button
            variant="gradient"
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
          <p className="text-muted-foreground mt-1 text-sm">
            {t("scanRedeemHint")}
          </p>
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

          {/* Camera-free fallback for local testing: paste the customer's code. */}
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
          <div className="text-muted-foreground text-base">
            {t("handRewardToCustomer")}
          </div>
          <Button
            variant="gradient"
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
