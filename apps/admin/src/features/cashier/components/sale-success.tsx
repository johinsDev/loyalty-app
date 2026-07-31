"use client";

import {
  Button,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Post-sale confirmation.
 *
 * States what THIS sale earned, never the customer's standing balances. The old
 * screen printed the stamp wallet unconditionally, so a sale that earned points
 * and no stamp showed "0/10 sellos" — the one number that hadn't moved — and hid
 * the points that had. A track can be enabled and still earn nothing on a given
 * sale (below the minimum ticket, or part-way through `purchasesPerStamp`), so
 * the filter is "did this sale earn it", not "is the track on".
 */
export function SaleSuccess({
  open,
  onClose,
  totalCents,
  earned,
  pointsBalance,
  tierUp,
  formatMoney,
}: {
  open: boolean;
  onClose: () => void;
  totalCents: number;
  earned: { stamps: number; points: number };
  pointsBalance: number;
  tierUp: { tierName: string } | null;
  formatMoney: (cents: number) => string;
}) {
  const t = useTranslations("Cashier");
  const earnedNothing = earned.stamps === 0 && earned.points === 0;

  return (
    <ResponsiveModal open={open} onOpenChange={(next) => !next && onClose()}>
      <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-sm">
        <div className="flex flex-col items-center px-6 pt-2 pb-6 text-center">
          <span className="from-primary to-primary/80 grid size-16 place-items-center rounded-3xl bg-gradient-to-br text-white shadow-lg">
            <Check className="size-8" strokeWidth={3} />
          </span>
          <ResponsiveModalTitle className="font-display mt-3 text-2xl font-semibold tracking-tight">
            {t("purchaseRecorded")}
          </ResponsiveModalTitle>

          <div className="font-display mt-1 text-3xl font-bold tabular-nums">
            {formatMoney(totalCents)}
          </div>

          {earnedNothing ? (
            <p className="text-muted-foreground mt-3 text-sm font-semibold">
              {t("earnedNothing")}
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-sm font-bold">
              {earned.stamps > 0 ? (
                <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-700 dark:text-amber-300">
                  +{earned.stamps} {t("stampMany")}
                </span>
              ) : null}
              {earned.points > 0 ? (
                <span className="bg-primary/15 text-primary rounded-full px-2.5 py-1">
                  +{earned.points} {t("earnPtsUnit")} · {pointsBalance}
                </span>
              ) : null}
            </div>
          )}

          {tierUp ? (
            <p className="mt-2 text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
              {t("tierUpNow", { tier: tierUp.tierName })}
            </p>
          ) : null}

          <Button
            size="lg"
            onClick={onClose}
            className="mt-6 h-11 w-full rounded-2xl text-base font-extrabold"
          >
            {t("nextMember")}
          </Button>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
