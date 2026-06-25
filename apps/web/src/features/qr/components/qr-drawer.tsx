"use client";

import { useSession } from "@loyalty/auth/client";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle,
  Skeleton,
  useIsMobile,
} from "@loyalty/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Gift, Sun, User, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

import type { ClaimCurrency, QrMode } from "../hooks/use-qr-drawer";
import { useQrDrawer } from "../hooks/use-qr-drawer";

/** Immersive dark backdrop from the design. */
const DARK_BG =
  "radial-gradient(120% 80% at 50% -10%, #18324a 0%, #0a1626 55%, #050b16 100%)";

/** How often a signed claim token is re-issued while the drawer stays open
 *  (the token TTL is short). */
const ROTATE_MS = 50_000;

/**
 * "Mi código" — the unified member-QR view shown as a near-full-screen drawer
 * over the current screen. By default it encodes the member identity
 * (`T4|<customerId>`) so a purchase earns stamps/points and a cashier can find
 * the member by the phone shown on the card. A horizontal selector lets the
 * customer switch to any READY reward (re-encodes to a signed `T4P|<token>`) or
 * the pending streak reward (`T4S|<token>`); the cashier scans it to claim. For
 * an "or"-cost reward that accepts both currencies the customer first picks
 * which to spend. "Brillo" flips the backdrop white for a high-contrast scan
 * (the web can't set system brightness).
 */
export function QrDrawer() {
  const t = useTranslations("Qr");
  const trpc = useTRPC();
  const open = useQrDrawer((s) => s.open);
  const setOpen = useQrDrawer((s) => s.setOpen);
  const mode = useQrDrawer((s) => s.mode);
  const setMode = useQrDrawer((s) => s.setMode);
  const { data: session } = useSession();
  const isMobile = useIsMobile();
  const [bright, setBright] = useState(false);

  const customerId = session?.user?.id ?? "guest";
  const user = session?.user as
    | { name?: string | null; phoneNumber?: string | null }
    | undefined;

  // Member profile for the card (name from session, tier from points summary).
  const summary = useQuery({
    ...trpc.points.mySummary.queryOptions(),
    enabled: open && Boolean(session?.user),
  });

  // Ready rewards + pending streak feed the selector.
  const readyRewards = useQuery({
    ...trpc.rewards.list.queryOptions({ filter: "listos", limit: 20 }),
    enabled: open && Boolean(session?.user),
  });
  const streak = useQuery({
    ...trpc.streaks.myStreak.queryOptions(),
    enabled: open && Boolean(session?.user),
  });
  const streakPending = streak.data?.rewardPending ?? false;

  // The signed claim token (re-issued while the relevant mode is selected).
  const issueReward = useMutation(trpc.rewards.issueClaimToken.mutationOptions());
  const issueStreak = useMutation(trpc.streaks.issueClaimToken.mutationOptions());
  const [claimToken, setClaimToken] = useState<string | null>(null);

  // (Re-)issue the token whenever the drawer opens onto a claim mode. Identity
  // needs no token. Rotated on an interval because the TTL is short.
  const rewardKey =
    mode.kind === "reward" ? `${mode.rewardId}:${mode.currency}` : null;
  useEffect(() => {
    if (!open || mode.kind === "identity") {
      setClaimToken(null);
      return;
    }
    let active = true;
    const issue = () => {
      const run =
        mode.kind === "reward"
          ? issueReward.mutateAsync({
              rewardId: mode.rewardId,
              currency: mode.currency,
            })
          : issueStreak.mutateAsync();
      run
        .then((r) => {
          if (active) setClaimToken(r.token);
        })
        .catch(() => {
          // Best-effort: the customer can reselect to retry. Don't toast — the
          // selector still shows identity, which always works.
          if (active) setClaimToken(null);
        });
    };
    setClaimToken(null);
    issue();
    const id = window.setInterval(issue, ROTATE_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode.kind, rewardKey]);

  const qrValue = useMemo(() => {
    if (mode.kind === "identity") return `T4|${customerId}`;
    if (!claimToken) return null;
    return mode.kind === "reward" ? `T4P|${claimToken}` : `T4S|${claimToken}`;
  }, [mode.kind, claimToken, customerId]);

  // Caption + the reward name for the "claim X" copy.
  const selectedReward =
    mode.kind === "reward"
      ? readyRewards.data?.items.find((r) => r.id === mode.rewardId)
      : undefined;
  const caption =
    mode.kind === "identity"
      ? t("instruction")
      : mode.kind === "streak"
        ? t("claimInstructionStreak")
        : t("claimInstructionReward", {
            reward: selectedReward?.name ?? t("rewardFallback"),
          });

  const iconBtn = bright
    ? "bg-neutral-100 text-neutral-700"
    : "bg-white/15 text-white";

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setBright(false);
      }}
    >
      <ResponsiveModalContent
        aria-describedby={undefined}
        showCloseButton={false}
        className="border-0"
        mobileClassName="mx-auto max-w-md"
        style={{
          background: bright ? "#ffffff" : DARK_BG,
          ...(isMobile ? { height: "92dvh", maxHeight: "92dvh" } : null),
        }}
      >
        <div
          className={`flex flex-col overflow-y-auto overscroll-contain px-6 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))] ${
            // `min-h-0 flex-1` (not `h-full`) so this region can shrink below its
            // content inside the flex-col Drawer and actually scroll on mobile.
            isMobile ? "min-h-0 flex-1" : ""
          }`}
        >
          <div className="mb-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("close")}
              className={`grid size-11 flex-none place-items-center rounded-full ${iconBtn}`}
            >
              <X className="size-5" />
            </button>
            <ResponsiveModalTitle
              className={`font-display flex-1 text-center text-xl font-semibold ${
                bright ? "text-neutral-900" : "text-white"
              }`}
            >
              {t("title")}
            </ResponsiveModalTitle>
            <button
              type="button"
              onClick={() => setBright((b) => !b)}
              aria-label={t("brightness")}
              aria-pressed={bright}
              className={`grid size-11 flex-none place-items-center rounded-full ${
                bright ? "bg-amber-300 text-neutral-900" : "bg-white/15 text-white"
              }`}
            >
              <Sun className="size-5" />
            </button>
          </div>

          <ModeSelector
            mode={mode}
            onSelect={setMode}
            bright={bright}
            readyRewards={readyRewards.data?.items ?? []}
            streakPending={streakPending}
          />

          {mode.kind === "reward" && selectedReward &&
          canChooseCurrency(selectedReward) ? (
            <CurrencyToggle
              bright={bright}
              current={mode.currency}
              stampsRequired={selectedReward.stampsRequired ?? 0}
              pointsCost={selectedReward.pointsCost ?? 0}
              onSelect={(currency) =>
                setMode({ kind: "reward", rewardId: mode.rewardId, currency })
              }
            />
          ) : null}

          <QrCard
            qrValue={qrValue}
            name={user?.name?.trim() || t("memberFallback")}
            phone={user?.phoneNumber ?? null}
            tierName={summary.data?.current.name ?? null}
            points={summary.data?.balance ?? null}
          />

          <p
            className={`mt-5 px-2 text-center text-sm leading-relaxed ${
              bright ? "text-neutral-600" : "text-white/80"
            }`}
          >
            {caption}
          </p>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

type ReadyReward = {
  id: string;
  name: string;
  costMode: "or" | "and";
  stampsRequired: number | null;
  pointsCost: number | null;
  affordableWith: ClaimCurrency[];
};

/** Derive the spend currency for a reward: a single accepted currency → that
 *  one; an "and" reward → "both"; an "or" reward that accepts both → the FIRST
 *  affordable currency (the customer can re-pick via the in-drawer toggle). The
 *  reward only reaches the selector when it's ready, so `affordableWith` is
 *  non-empty — we never default to a balance the customer can't pay. */
function rewardCurrency(reward: {
  costMode: "or" | "and";
  stampsRequired: number | null;
  pointsCost: number | null;
  affordableWith: ClaimCurrency[];
}): ClaimCurrency {
  const hasStamps = reward.stampsRequired != null;
  const hasPoints = reward.pointsCost != null;
  if (hasStamps && !hasPoints) return "stamps";
  if (hasPoints && !hasStamps) return "points";
  if (reward.costMode === "and") return "both";
  // "or" accepting both: prefer a currency the customer can pay (first
  // affordable). Falls back to stamps only if nothing is affordable yet (the
  // reward shouldn't be in the ready list in that case).
  return reward.affordableWith[0] ?? "stamps";
}

/** Whether an OR reward gives the customer a real currency choice right now
 *  (accepts both AND both are affordable). */
function canChooseCurrency(reward: {
  costMode: "or" | "and";
  stampsRequired: number | null;
  pointsCost: number | null;
  affordableWith: ClaimCurrency[];
}): boolean {
  return (
    reward.costMode === "or" &&
    reward.stampsRequired != null &&
    reward.pointsCost != null &&
    reward.affordableWith.includes("stamps") &&
    reward.affordableWith.includes("points")
  );
}

/** Horizontal chips: Identificarme · each ready reward · pending streak. */
function ModeSelector({
  mode,
  onSelect,
  bright,
  readyRewards,
  streakPending,
}: {
  mode: QrMode;
  onSelect: (mode: QrMode) => void;
  bright: boolean;
  readyRewards: ReadyReward[];
  streakPending: boolean;
}) {
  const t = useTranslations("Qr");

  const chip = (active: boolean) =>
    active
      ? bright
        ? "bg-neutral-900 text-white border-neutral-900"
        : "bg-white text-neutral-900 border-white"
      : bright
        ? "bg-neutral-100 text-neutral-600 border-neutral-200"
        : "bg-white/10 text-white/85 border-white/15";

  // Nothing to claim → no selector (identity-only view).
  if (readyRewards.length === 0 && !streakPending) return null;

  return (
    <div className="-mx-6 mb-5 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        onClick={() => onSelect({ kind: "identity" })}
        aria-pressed={mode.kind === "identity"}
        className={`inline-flex h-9 flex-none items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold whitespace-nowrap transition-colors ${chip(
          mode.kind === "identity",
        )}`}
      >
        <User className="size-3.5" />
        {t("selectIdentity")}
      </button>
      {readyRewards.map((reward) => {
        const active = mode.kind === "reward" && mode.rewardId === reward.id;
        return (
          <button
            key={reward.id}
            type="button"
            onClick={() =>
              onSelect({
                kind: "reward",
                rewardId: reward.id,
                currency: rewardCurrency(reward),
              })
            }
            aria-pressed={active}
            className={`inline-flex h-9 flex-none items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold whitespace-nowrap transition-colors ${chip(
              active,
            )}`}
          >
            <Gift className="size-3.5" />
            {reward.name}
          </button>
        );
      })}
      {streakPending ? (
        <button
          type="button"
          onClick={() => onSelect({ kind: "streak" })}
          aria-pressed={mode.kind === "streak"}
          className={`inline-flex h-9 flex-none items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold whitespace-nowrap transition-colors ${chip(
            mode.kind === "streak",
          )}`}
        >
          <Gift className="size-3.5" />
          {t("selectStreak")}
        </button>
      ) : null}
    </div>
  );
}

/** Sellos / Puntos toggle for an OR reward affordable with both — lets the
 *  customer choose which balance to spend before the claim token is issued. */
function CurrencyToggle({
  bright,
  current,
  stampsRequired,
  pointsCost,
  onSelect,
}: {
  bright: boolean;
  current: ClaimCurrency;
  stampsRequired: number;
  pointsCost: number;
  onSelect: (currency: "stamps" | "points") => void;
}) {
  const t = useTranslations("Qr");
  const options: { key: "stamps" | "points"; label: string }[] = [
    { key: "stamps", label: t("payStamps", { count: stampsRequired }) },
    { key: "points", label: t("payPoints", { count: pointsCost }) },
  ];
  const chip = (active: boolean) =>
    active
      ? bright
        ? "bg-neutral-900 text-white border-neutral-900"
        : "bg-white text-neutral-900 border-white"
      : bright
        ? "bg-neutral-100 text-neutral-600 border-neutral-200"
        : "bg-white/10 text-white/85 border-white/15";
  return (
    <div className="mb-5">
      <p
        className={`mb-2 text-center text-xs font-bold tracking-wider uppercase ${
          bright ? "text-neutral-500" : "text-white/60"
        }`}
      >
        {t("chooseCurrency")}
      </p>
      <div className="flex gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onSelect(o.key)}
            aria-pressed={current === o.key}
            className={`h-10 flex-1 rounded-full border text-sm font-bold transition-colors ${chip(
              current === o.key,
            )}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Always-light card (the QR must stay white for scanning) — uses neutral-* so
 *  it doesn't invert with the app theme. */
function QrCard({
  qrValue,
  name,
  phone,
  tierName,
  points,
}: {
  qrValue: string | null;
  name: string;
  phone: string | null;
  tierName: string | null;
  points: number | null;
}) {
  const t = useTranslations("Qr");
  const initial = name.charAt(0).toUpperCase() || "·";
  return (
    <div className="w-full rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-black/5">
      <div className="flex items-center gap-3">
        <span className="bg-primary/10 text-primary font-display grid size-12 flex-none place-items-center rounded-full text-xl font-semibold">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-extrabold text-neutral-900">
            {name}
          </p>
          {tierName ? (
            <p className="text-sm text-neutral-500">
              {t("tierLine", { tier: tierName, points: points ?? 0 })}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid place-items-center rounded-2xl bg-white p-3">
        {qrValue ? (
          <QRCodeSVG
            value={qrValue}
            size={236}
            level="M"
            marginSize={0}
            fgColor="#000323"
            bgColor="#ffffff"
          />
        ) : (
          <Skeleton className="size-[236px] rounded-xl" />
        )}
      </div>

      {phone ? (
        <div className="mt-4 text-center">
          <p className="text-xs font-bold tracking-wider text-neutral-500">
            {t("memberPhone")}
          </p>
          <p className="font-display mt-1 text-2xl font-semibold tracking-widest text-neutral-900">
            {phone}
          </p>
        </div>
      ) : null}
    </div>
  );
}
