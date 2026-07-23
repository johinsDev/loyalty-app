"use client";

import type { AppRouter } from "@loyalty/api";
import { Button, CurrencyInput } from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import {
  ArrowLeft,
  Ban,
  Cake,
  CalendarDays,
  Check,
  Flame,
  Gift,
  KeyRound,
  QrCode,
  ShoppingBag,
  Sparkles,
  StickyNote,
  Store,
  User,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

import { CATALOG_STALE_MS } from "../catalog-cache";
import { useActiveStoreId } from "../use-active-store";

import { IdentifyPane, type IdentifiedCustomer } from "./identify-pane";
import { ItemizedPurchase, type PreselectReward } from "./itemized-purchase";
import { QrScanner } from "./qr-scanner";
import { RecentMovements } from "./recent-movements";
import { StorelessConfirm } from "./storeless-confirm";

type CustomerHit = IdentifiedCustomer;

type WalletView = inferRouterOutputs<AppRouter>["stamps"]["walletForCustomer"];
/** A resolved reward claim (scan/code): identifies the customer + reward so the
 *  register can open with it preselected. Redemption happens in recordPurchase. */
type ResolveClaim = inferRouterOutputs<AppRouter>["rewards"]["resolveClaim"];
type AvailableReward =
  inferRouterOutputs<AppRouter>["rewards"]["availableForCustomer"][number];

/** What the no-scanner code path is claiming — a reward or the pending streak.
 *  Carries the `pendingId` returned by `requestClaim` plus a label for the UI. */
type PendingClaim =
  | { kind: "reward"; pendingId: string; label: string }
  | { kind: "streak"; pendingId: string; label: string };

type Step =
  | "identify"
  | "found"
  | "purchase-success"
  | "scan"
  | "code-entry"
  | "claim-success";

/** QR prefixes the customer app renders for single-use claim tokens. */
const REWARD_PREFIX = "T4P|"; // stamps/points reward
const STREAK_PREFIX = "T4S|"; // streak reward

const formatCop = (cents: number): string =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(cents) / 100);

/** One labelled figure in the customer detail grid. `full` spans both columns. */
function Stat({
  label,
  value,
  icon,
  full,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`bg-muted rounded-2xl p-3 ${full ? "col-span-2" : ""}`}>
      <div className="text-muted-foreground/70 flex items-center gap-1 text-[0.6875rem] font-extrabold tracking-wider">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-bold">{value}</div>
    </div>
  );
}

/**
 * Escanear tab — wired to the real ledger backend. Search a socio
 * (`customers.search`), load their wallet (`stamps.walletForCustomer`), record a
 * purchase by price (`stamps.recordPurchase`), and see which rewards are ready
 * to claim (`rewards.availableForCustomer`). Scanning the customer's reward QR
 * claims it: `T4P|` → `rewards.claim`, `T4S|` → `streaks.claimReward`.
 */
export function ScanView() {
  const t = useTranslations("Cashier");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Shift prefetch: warm the store catalog when the cashier enters the register
  // so the first itemized search + variant picker are instant (long staleTime).
  useEffect(() => {
    void queryClient.prefetchQuery(
      trpc.menu.list.queryOptions({ pageSize: 20 }, { staleTime: CATALOG_STALE_MS }),
    );
  }, [queryClient, trpc]);

  const [step, setStep] = useState<Step>("identify");
  const [selected, setSelected] = useState<CustomerHit | null>(null);
  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [priceCop, setPriceCop] = useState<number | undefined>(undefined);
  const [purchaseMode, setPurchaseMode] = useState<"total" | "items">("total");
  const [pastedCode, setPastedCode] = useState("");
  // A reward resolved from a scan/code, preselected into the itemized register.
  const [preselectReward, setPreselectReward] = useState<PreselectReward | null>(
    null,
  );
  // No-scanner code path: the pending claim + the 6-digit code the cashier types.
  const [pendingClaim, setPendingClaim] = useState<PendingClaim | null>(null);
  const [codeInput, setCodeInput] = useState("");
  // "Facturar sin tienda" confirm for the total-price path.
  const [storelessOpen, setStorelessOpen] = useState(false);

  // Staff-safe CRM detail for the selected customer (masked contact, tier,
  // points, visit stats, acquisition, ban) — powers the rich found card.
  const registerCtx = useQuery(
    trpc.customers.registerContext.queryOptions(
      { customerId: selected?.id ?? "" },
      { enabled: step === "found" && Boolean(selected) },
    ),
  );

  // Read-only nudge: rewards this socio can claim right now.
  const available = useQuery(
    trpc.rewards.availableForCustomer.queryOptions(
      { customerId: selected?.id ?? "" },
      { enabled: step === "found" && Boolean(selected) },
    ),
  );

  // Pending streak reward (staff read) — claimable via the same code path.
  const streak = useQuery(
    trpc.streaks.streakForCustomer.queryOptions(
      { customerId: selected?.id ?? "" },
      { enabled: step === "found" && Boolean(selected) },
    ),
  );
  const streakPending = streak.data?.rewardPending ?? false;

  const activeStoreId = useActiveStoreId();
  const recordPurchase = useMutation(
    trpc.stamps.recordPurchase.mutationOptions(),
  );
  // Rewards resolve (identify), never redeem — the sale's recordPurchase does the
  // redemption. Streak claims stay standalone (T4S → claim-success).
  const resolveClaim = useMutation(trpc.rewards.resolveClaim.mutationOptions());
  const resolveClaimWithCode = useMutation(
    trpc.rewards.resolveClaimWithCode.mutationOptions(),
  );
  const claimStreak = useMutation(trpc.streaks.claimReward.mutationOptions());
  const requestRewardClaim = useMutation(
    trpc.rewards.requestClaim.mutationOptions(),
  );
  const requestStreakClaim = useMutation(
    trpc.streaks.requestClaim.mutationOptions(),
  );
  const confirmStreakClaim = useMutation(
    trpc.streaks.confirmClaimWithCode.mutationOptions(),
  );
  const isClaiming = resolveClaim.isPending || claimStreak.isPending;
  const isRequesting =
    requestRewardClaim.isPending || requestStreakClaim.isPending;
  const isConfirming =
    resolveClaimWithCode.isPending || confirmStreakClaim.isPending;

  const reset = () => {
    setStep("identify");
    setSelected(null);
    setWallet(null);
    setPriceCop(undefined);
    setPreselectReward(null);
    setPurchaseMode("total");
    setPendingClaim(null);
    setCodeInput("");
  };

  // A resolved reward (scan or code) routes into the itemized register with the
  // reward preselected — redemption is folded into the sale, not standalone.
  // Scanned before identifying (from the identify pane), we adopt the customer
  // from the claim + load their wallet; the rich card fills name/phone from
  // registerContext.
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
    setPendingClaim(null);
    setCodeInput("");
    setPurchaseMode("items");
    setStep("found");
    toast.success(t("rewardResolvedToast"));
  };

  // No-scanner path: request a 6-digit code (delivered to the customer's phone),
  // then move to the code-entry step. The customer picks the spend currency for
  // an OR reward on their own phone — the cashier no longer chooses it.
  const startRewardClaim = async (reward: AvailableReward) => {
    if (!selected) return;
    try {
      const res = await requestRewardClaim.mutateAsync({
        customerId: selected.id,
        rewardId: reward.rewardId,
      });
      setPendingClaim({
        kind: "reward",
        pendingId: res.pendingId,
        label: reward.name,
      });
      setCodeInput("");
      setStep("code-entry");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("codeRequestError"));
    }
  };

  const startStreakClaim = async () => {
    if (!selected) return;
    try {
      const res = await requestStreakClaim.mutateAsync({
        customerId: selected.id,
      });
      setPendingClaim({
        kind: "streak",
        pendingId: res.pendingId,
        label: t("streakReward"),
      });
      setCodeInput("");
      setStep("code-entry");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("codeRequestError"));
    }
  };

  const confirmCode = async () => {
    if (!pendingClaim) return;
    const code = codeInput.trim();
    try {
      if (pendingClaim.kind === "reward") {
        // Resolve (no redemption) → open the register with the reward preselected.
        const resolved = await resolveClaimWithCode.mutateAsync({
          pendingId: pendingClaim.pendingId,
          code,
        });
        await openRegisterWithReward(resolved);
        return;
      }
      await confirmStreakClaim.mutateAsync({
        pendingId: pendingClaim.pendingId,
        code,
      });
      setStep("claim-success");
      toast.success(t("claimValidated"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "CODE_INVALID") toast.error(t("codeInvalid"));
      else if (msg === "CODE_EXPIRED") toast.error(t("codeExpired"));
      else if (msg === "TOO_MANY_ATTEMPTS") toast.error(t("codeTooMany"));
      else if (msg === "NOT_YOUR_CLAIM") toast.error(t("codeNotYours"));
      else if (msg === "ALREADY_CLAIMED") toast.error(t("alreadyClaimed"));
      else if (msg === "INSUFFICIENT_BALANCE")
        toast.error(t("insufficientBalance"));
      else toast.error(t("codeConfirmError"));
    }
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

  const onRecordPurchase = () => {
    if (!selected || priceCop === undefined) return;
    if (!activeStoreId) {
      setStorelessOpen(true);
      return;
    }
    void submitPurchase();
  };

  const submitPurchase = async () => {
    if (!selected || priceCop === undefined) return;
    setStorelessOpen(false);
    try {
      const view = await recordPurchase.mutateAsync({
        customerId: selected.id,
        storeId: activeStoreId ?? undefined,
        priceCents: Math.round(priceCop * 100),
        idempotencyKey: crypto.randomUUID(),
      });
      setWallet(view);
      setStep("purchase-success");
      toast.success(t("purchaseRecorded"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("purchaseError"));
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
          // Resolve only (no redemption) → open the register with the reward
          // preselected; the sale's recordPurchase does the deduction.
          const resolved = await resolveClaim.mutateAsync({ token });
          await openRegisterWithReward(resolved);
        }
      } catch (err) {
        if (err instanceof Error && err.message === "ALREADY_CLAIMED") {
          toast.error(t("alreadyClaimed"));
        } else if (
          err instanceof Error &&
          err.message === "INSUFFICIENT_BALANCE"
        ) {
          toast.error(t("insufficientBalance"));
        } else {
          toast.error(t("invalidToken"));
        }
      }
    },
    [claimStreak, resolveClaim, openRegisterWithReward, t],
  );

  const customerName = (hit: CustomerHit | null) =>
    hit?.name?.trim() || hit?.phone || t("unknownCustomer");

  const acqLabel = (channel: string) => {
    if (channel === "staff-register") return t("acqStaffRegister");
    if (channel === "google") return t("acqGoogle");
    return t("acqSelfApp");
  };

  // The identify (two-pane) and itemized register need a wider canvas on
  // tablet/desktop; the other linear steps stay narrow and centered.
  const wide = step === "identify" || (step === "found" && purchaseMode === "items");

  return (
    <div
      className={`mx-auto w-full px-5 py-5 ${wide ? "max-w-2xl lg:max-w-6xl" : "max-w-2xl lg:max-w-4xl"}`}
    >
      {/* Identify — the principal register view: identify pane + a live
          recent-movements panel side by side on tablet/desktop (T4 Caja). */}
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
        <div className="flex flex-col gap-5">
          <div className="bg-card border-border rounded-3xl border p-5 shadow-sm">
            <div className="flex items-center gap-3.5">
              <span className="bg-muted text-muted-foreground grid size-14 flex-none place-items-center rounded-full">
                <User className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-extrabold">
                  {selected.name?.trim() ||
                    registerCtx.data?.name?.trim() ||
                    registerCtx.data?.phoneMasked ||
                    t("unknownCustomer")}
                </div>
                <div className="text-muted-foreground text-sm font-semibold">
                  {registerCtx.data?.phoneMasked || selected.phone || ""}
                  {registerCtx.data?.emailMasked ? ` · ${registerCtx.data.emailMasked}` : ""}
                </div>
              </div>
              {registerCtx.data?.tierKey ? (
                <span className="bg-primary/10 text-primary flex-none rounded-full px-2.5 py-1 text-xs font-extrabold capitalize">
                  {registerCtx.data.tierKey}
                </span>
              ) : null}
            </div>

            {/* Banned socios can't earn/redeem — warn the cashier up front. */}
            {registerCtx.data?.banned ? (
              <div className="border-destructive/40 bg-destructive/10 text-destructive mt-4 flex items-center gap-2 rounded-2xl border p-3 text-sm font-bold">
                <Ban className="size-4 flex-none" />
                {t("customerBanned")}
              </div>
            ) : null}

            {/* Birthday nudge — the personal touch: greet / offer something. */}
            {registerCtx.data?.birthdayInDays != null ? (
              <div className="border-primary/30 bg-primary/10 text-primary mt-4 flex items-center gap-2 rounded-2xl border p-3 text-sm font-bold">
                <Cake className="size-4 flex-none" />
                {registerCtx.data.birthdayInDays === 0
                  ? t("birthdayToday")
                  : t("birthdaySoon", { days: registerCtx.data.birthdayInDays })}
              </div>
            ) : null}

            {/* Staff note (allergies / preferences) — serve them personally. */}
            {registerCtx.data?.notes ? (
              <div className="border-border bg-muted/40 mt-4 rounded-2xl border p-3">
                <div className="text-muted-foreground/70 flex items-center gap-1 text-[0.6875rem] font-extrabold tracking-wider">
                  <StickyNote className="size-3.5" />
                  {t("detailNotes")}
                </div>
                <p className="text-foreground mt-0.5 text-sm font-semibold">
                  {registerCtx.data.notes}
                </p>
              </div>
            ) : null}

            {/* CRM context — helps the cashier serve personally (decision #8). */}
            {registerCtx.data ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Stat label={t("detailPoints")} value={String(registerCtx.data.points)} />
                <Stat label={t("detailVisits")} value={String(registerCtx.data.visits)} />
                <Stat
                  label={t("detailAvgTicket")}
                  value={formatCop(registerCtx.data.avgTicketCents)}
                />
                <Stat
                  label={t("detailLastVisit")}
                  value={
                    registerCtx.data.lastVisitAt
                      ? new Date(registerCtx.data.lastVisitAt).toLocaleDateString("es-CO", {
                          day: "numeric",
                          month: "short",
                        })
                      : t("detailNever")
                  }
                />
                <Stat
                  label={t("detailMemberSince")}
                  value={new Date(registerCtx.data.memberSince).toLocaleDateString("es-CO", {
                    month: "short",
                    year: "numeric",
                  })}
                  icon={<CalendarDays className="size-3.5" />}
                />
                {registerCtx.data.birthday ? (
                  <Stat
                    label={t("detailBirthday")}
                    value={new Date(registerCtx.data.birthday).toLocaleDateString("es-CO", {
                      day: "numeric",
                      month: "short",
                    })}
                    icon={<Cake className="size-3.5" />}
                  />
                ) : null}
                {registerCtx.data.topProduct ? (
                  <Stat
                    label={t("detailTopProduct")}
                    value={registerCtx.data.topProduct}
                    icon={<ShoppingBag className="size-3.5" />}
                    full
                  />
                ) : null}
                {registerCtx.data.acquisition.channel ? (
                  <Stat
                    label={t("detailAcquisition")}
                    value={
                      registerCtx.data.acquisition.storeName
                        ? `${acqLabel(registerCtx.data.acquisition.channel)} · ${registerCtx.data.acquisition.storeName}`
                        : acqLabel(registerCtx.data.acquisition.channel)
                    }
                    icon={
                      registerCtx.data.acquisition.channel === "staff-register" ? (
                        <Store className="size-3.5" />
                      ) : (
                        <Sparkles className="size-3.5" />
                      )
                    }
                    full
                  />
                ) : null}
              </div>
            ) : null}

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

            {/* Claimable now — each is actionable via the no-scanner code path. */}
            {(available.data && available.data.length > 0) || streakPending ? (
              <div className="bg-primary/10 mt-4 rounded-2xl p-3.5">
                <div className="text-primary inline-flex items-center gap-1.5 text-xs font-extrabold tracking-wide">
                  <Gift className="size-4" />
                  {t("availableRewardsLabel")}
                </div>
                <div className="mt-2.5 flex flex-col gap-2">
                  {available.data?.map((reward) => (
                    <div
                      key={reward.rewardId}
                      className="bg-card border-border flex items-center gap-2 rounded-xl border p-2.5"
                    >
                      <span className="text-foreground min-w-0 flex-1 truncate text-sm font-bold">
                        {reward.name}
                      </span>
                      <Button
                        size="sm"
                        variant="default"
                        disabled={isRequesting}
                        onClick={() => void startRewardClaim(reward)}
                        className="h-10 flex-none gap-1.5 rounded-xl px-3 text-xs font-extrabold"
                      >
                        <KeyRound className="size-4" />
                        {t("claimWithoutScanner")}
                      </Button>
                    </div>
                  ))}
                  {streakPending ? (
                    <div className="bg-card border-border flex items-center gap-2 rounded-xl border p-2.5">
                      <span className="text-foreground inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-bold">
                        <Flame className="text-primary size-4 flex-none" />
                        {t("streakReward")}
                      </span>
                      <Button
                        size="sm"
                        variant="default"
                        disabled={isRequesting}
                        onClick={() => void startStreakClaim()}
                        className="h-10 flex-none gap-1.5 rounded-xl px-3 text-xs font-extrabold"
                      >
                        <KeyRound className="size-4" />
                        {t("claimWithoutScanner")}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

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
                  variant="default"
                  size="lg"
                  disabled={priceCop === undefined || recordPurchase.isPending}
                  onClick={onRecordPurchase}
                  className="mt-4 h-10 w-full gap-2 rounded-2xl text-base font-extrabold"
                >
                  <Check className="size-5" />
                  {t("recordPurchase")}
                </Button>
              </>
            ) : (
              <ItemizedPurchase
                customerId={selected.id}
                preselect={preselectReward ?? undefined}
                onSuccess={(view) => {
                  setWallet(view);
                  setPreselectReward(null);
                  setStep("purchase-success");
                }}
                onRewardPending={() => setStep("scan")}
              />
            )}
          </div>
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
          <Button
            variant="default"
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

      {step === "code-entry" && pendingClaim && selected && (
        <div className="bg-card border-border mx-auto max-w-md rounded-3xl border p-6 shadow-sm">
          <button
            type="button"
            onClick={() => {
              setPendingClaim(null);
              setCodeInput("");
              setStep("found");
            }}
            className="text-muted-foreground mb-3.5 flex items-center gap-1 text-sm font-bold"
          >
            <ArrowLeft className="size-4" />
            {t("back")}
          </button>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t("codeEntryTitle", { reward: pendingClaim.label })}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("codeEntryHint", { customer: customerName(selected) })}
          </p>
          <label className="text-muted-foreground/70 mt-4 mb-1.5 block text-[0.6875rem] font-extrabold tracking-wider">
            {t("codeLabel")}
          </label>
          <input
            value={codeInput}
            onChange={(e) =>
              setCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            className="border-border bg-muted placeholder:text-muted-foreground/50 font-display h-12 w-full rounded-2xl border px-3.5 text-center text-2xl font-semibold tracking-[0.4em] tabular-nums outline-none"
          />
          <Button
            variant="default"
            size="lg"
            disabled={codeInput.trim().length !== 6 || isConfirming}
            onClick={() => void confirmCode()}
            className="mt-4 h-10 w-full gap-2 rounded-2xl text-base font-extrabold"
          >
            <Check className="size-5" />
            {t("confirmClaim")}
          </Button>
          {isConfirming ? (
            <div className="text-muted-foreground mt-3 text-center text-sm font-semibold">
              {t("validating")}
            </div>
          ) : null}
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
            variant="default"
            size="lg"
            onClick={reset}
            className="mt-3 h-10 w-full max-w-xs rounded-2xl text-base font-extrabold"
          >
            {t("done")}
          </Button>
        </div>
      )}

      <StorelessConfirm
        open={storelessOpen}
        onOpenChange={setStorelessOpen}
        onConfirm={() => void submitPurchase()}
      />
    </div>
  );
}
