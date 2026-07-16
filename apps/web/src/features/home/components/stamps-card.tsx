"use client";

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  StampCardTemplate,
  type StampCardView,
  type StampSpot,
  TiltCard,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { useCurrency } from "@/lib/currency";
import { useTRPC } from "@/lib/trpc/client";

import { StampsCardSkeleton } from "./stamps-card-skeleton";

type Selected =
  | { kind: "filled"; n: number }
  | { kind: "empty"; n: number }
  | { kind: "reward" };

/** Interpolate `{token}` placeholders in an org copy override. Unknown tokens
 *  are left literal (the API validates them away on save; belt-and-braces). */
function fillPlaceholders(text: string, vars: Record<string, number | string>): string {
  return text.replace(/\{(\w+)\}/g, (raw, key: string) =>
    vars[key] === undefined ? raw : String(vars[key]),
  );
}

/**
 * Stamp wallet — the org-configured card: goal, template, stamp icon/color/off
 * style and copy all come from the public `settings.loyaltyConfig` (shared
 * query with the points card), while the customer's real progress comes from
 * `stamps.myWallet` + `stamps.myHistory` (client `useQuery` so the cookie is
 * sent; the realtime listener invalidates them so a new stamp pops in live).
 * `currentStamps` is a spendable balance (it can exceed the card) — the visual
 * shows progress within the current buy-N-get-1 cycle. Tapping a filled stamp
 * reveals the purchase that earned it; an empty one shows how many are left;
 * the reward spot shows the linked prize (claimed via the rewards screen).
 */
export function StampsCard() {
  const t = useTranslations("Home");
  const format = useFormatter();
  const trpc = useTRPC();
  const { defaultCurrency } = useCurrency();
  const [selected, setSelected] = useState<Selected | null>(null);

  const { data: w } = useQuery(trpc.stamps.myWallet.queryOptions());
  const { data: history } = useQuery(
    trpc.stamps.myHistory.queryOptions({ page: 1, pageSize: 20 }),
  );
  const { data: loyalty } = useQuery(trpc.settings.loyaltyConfig.queryOptions());

  if (!w || !history) return <StampsCardSkeleton />;
  // Stamps paused (org runs points-only): nothing to earn. With stamps on the
  // card it stays in a redeem-only state; empty, there's nothing to show.
  if (w.paused && w.currentStamps === 0) return null;

  const cfg = loyalty?.stampsCard;
  const ov = cfg?.copy ?? {};

  const goal = w.stampsGoal;
  // `currentStamps` can exceed the card — show the in-cycle progress (a full
  // card when the balance is an exact multiple of the goal).
  const inCycle = goal > 0 ? w.currentStamps % goal : 0;
  const filled = inCycle === 0 && w.currentStamps > 0 ? goal : inCycle;
  const remaining = Math.max(0, goal - filled);

  // The purchases that actually earned a stamp on THIS wallet, oldest →
  // newest; the last `filled` of them map to the current cycle's spots 1..N.
  const stampingPurchases = history.rows
    .filter((r) => r.walletSequence === w.sequence && r.stamps > 0)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const purchaseForSpot = (n: number) =>
    stampingPurchases[stampingPurchases.length - filled + (n - 1)];

  const money = (cents: number) =>
    format.number(cents / 100, {
      style: "currency",
      currency: defaultCurrency,
      useGrouping: "always",
    });

  const rewardTitle = ov.rewardTitle ?? t("stampRewardTitle");
  const filledTitle = ov.filledTitle ?? t("stampFilledTitle");
  const emptyTitle = ov.emptyTitle ?? t("stampEmptyTitle");

  // Drop focus off the trigger before a modal/drawer aria-hides the background,
  // so assistive tech doesn't warn about focus retained under aria-hidden.
  const onSpotPress = (spot: StampSpot) => {
    (document.activeElement as HTMLElement | null)?.blur();
    setSelected(
      spot.kind === "reward" ? { kind: "reward" } : { kind: spot.kind, n: spot.index },
    );
  };

  const view: StampCardView = {
    goal,
    filledInCycle: filled,
    totalStamps: w.currentStamps,
    pending:
      w.purchasesPerStamp > 1
        ? { have: w.pendingPurchases, need: w.purchasesPerStamp }
        : null,
    icon: cfg?.style?.icon ?? { kind: "lucide", value: "cup-soda" },
    onColor: cfg?.style?.onColor ?? null,
    offStyle: cfg?.style?.offStyle ?? "number",
    title: ov.title ?? t("stampsTitle"),
    subtitle: ov.subtitle
      ? fillPlaceholders(ov.subtitle, { count: remaining })
      : t("stampsRemaining", { count: remaining }),
    countLabel: t("stampsCount", { filled, total: goal }),
    pendingLabel:
      w.purchasesPerStamp > 1
        ? t("stampsPending", {
            have: w.pendingPurchases,
            need: w.purchasesPerStamp,
          })
        : null,
    pausedLabel: w.paused ? (ov.paused ?? t("stampsPaused")) : null,
    prizeName: cfg?.prize?.name ?? null,
    spotAriaLabel: (spot) =>
      spot.kind === "reward" ? rewardTitle : spot.kind === "filled" ? filledTitle : emptyTitle,
    onSpotPress,
  };

  return (
    <>
      <TiltCard>
        <StampCardTemplate template={cfg?.template ?? "classic"} view={view} />
      </TiltCard>

      <ResponsiveModal
        open={selected !== null}
        onOpenChange={(next) => !next && setSelected(null)}
      >
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          <StampDetail
            selected={selected}
            goal={goal}
            copy={ov}
            prize={cfg?.prize ?? null}
            purchase={
              selected?.kind === "filled" ? purchaseForSpot(selected.n) : undefined
            }
            money={money}
            formatDate={(d) => format.dateTime(d, { dateStyle: "medium" })}
          />
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}

function StampDetail({
  selected,
  goal,
  copy,
  prize,
  purchase,
  money,
  formatDate,
}: {
  selected: Selected | null;
  goal: number;
  copy: Partial<
    Record<
      | "filledTitle"
      | "filledBody"
      | "emptyTitle"
      | "emptyBody"
      | "rewardTitle"
      | "rewardBody",
      string
    >
  >;
  prize: { name: string; description: string | null } | null;
  purchase: { priceCents: number; createdAt: Date } | undefined;
  money: (cents: number) => string;
  formatDate: (d: Date) => string;
}) {
  const t = useTranslations("Home");
  if (!selected) return null;

  if (selected.kind === "reward") {
    // Precedence: org copy override → linked reward description → i18n default.
    const body =
      copy.rewardBody ?? prize?.description ?? t("stampDetailReward");
    return (
      <>
        <ResponsiveModalHeader className="text-left">
          <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
            {copy.rewardTitle ?? t("stampRewardTitle")}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="sr-only">
            {body}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <div className="space-y-4 px-4 pb-6">
          <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-400 p-5 text-white shadow-md shadow-amber-400/40">
            <Gift className="size-9 flex-none" />
            <div className="flex min-w-0 flex-col gap-0.5">
              {prize?.name ? (
                <p className="text-base font-bold">{prize.name}</p>
              ) : null}
              <p className="text-sm font-semibold">{body}</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (selected.kind === "empty") {
    const count = goal - selected.n + 1;
    const body = copy.emptyBody
      ? fillPlaceholders(copy.emptyBody, { count })
      : t("stampDetailEmpty", { count });
    return (
      <>
        <ResponsiveModalHeader className="text-left">
          <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
            {copy.emptyTitle ?? t("stampEmptyTitle")}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="sr-only">{body}</ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <div className="px-4 pb-6">
          <div className="text-muted-foreground border-primary/30 bg-primary/5 rounded-2xl border-2 border-dashed p-5 text-sm font-semibold">
            {body}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <ResponsiveModalHeader className="text-left">
        <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
          {copy.filledTitle ?? t("stampFilledTitle")}
        </ResponsiveModalTitle>
        {purchase ? (
          <ResponsiveModalDescription>
            {formatDate(purchase.createdAt)}
          </ResponsiveModalDescription>
        ) : null}
      </ResponsiveModalHeader>
      <div className="px-4 pb-6">
        <div className="bg-card flex items-center gap-4 rounded-2xl p-4 ring-1 ring-black/5 dark:ring-white/10">
          <span className="from-primary/10 to-primary/5 grid size-14 flex-none place-items-center rounded-2xl bg-gradient-to-br text-2xl">
            🧋
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-foreground text-base font-bold">
              {copy.filledBody ?? copy.filledTitle ?? t("stampFilledTitle")}
            </span>
            {purchase ? (
              <span className="bg-primary/10 text-primary inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-extrabold">
                {money(purchase.priceCents)} · +1 🧋
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
