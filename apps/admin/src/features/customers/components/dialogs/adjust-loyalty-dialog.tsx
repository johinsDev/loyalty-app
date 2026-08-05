"use client";

import {
  Button,
  cn,
  NumberInput,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  SegmentedControl,
  Textarea,
} from "@loyalty/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Equal, Minus, Plus } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

export type LoyaltyCurrency = "points" | "stamps";

/** How the typed number relates to the balance. */
type Mode = "add" | "subtract" | "set";

/** Server caps (`adjustForCustomerInputSchema`), mirrored so the dialog can say
 *  so before the request instead of failing it. */
const CAP: Record<LoyaltyCurrency, number> = { points: 100_000, stamps: 100 };

/**
 * The locale's own separators — "." / "," for es, "," / "." for en.
 *
 * Both, not just the group one: `react-number-format` throws outright if the
 * thousands separator matches its decimal separator, and its default decimal is
 * "." — which is exactly Spanish's group separator.
 */
function separators(locale: string): { group: string; decimal: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(10_000.5);
  return {
    group: parts.find((p) => p.type === "group")?.value ?? ",",
    decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
  };
}

/**
 * Owner-only manual correction of a customer's balance, with no purchase
 * attached. Writes a signed ledger row (visible in Loyalty + Activity) and an
 * audit entry.
 *
 * The operator picks an operation and types a plain positive number; the signed
 * delta the API wants is derived. It used to be one bare field whose hint read
 * "usá un número negativo para descontar", so taking 50 points off meant typing
 * `-50` and trusting it — the screen never said what the balance was, never
 * mind what it would become. "Fijar total" exists because that is how the
 * correction is usually phrased out loud ("debería tener 1.200"), and doing
 * that subtraction in your head against a balance the dialog wasn't showing is
 * where the mistakes came from.
 */
export function AdjustLoyaltyDialog({
  customerId,
  currency,
  currentBalance,
  open,
  onOpenChange,
}: {
  customerId: string;
  currency: LoyaltyCurrency;
  /** Today's balance — the thing every mode is relative to. */
  currentBalance: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Customers");
  const format = useFormatter();
  const locale = useLocale();
  const sep = separators(locale);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("add");
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [reason, setReason] = useState("");

  const adjustPoints = useMutation(trpc.points.adjustForCustomer.mutationOptions());
  const adjustStamps = useMutation(trpc.stamps.adjustForCustomer.mutationOptions());
  const pending = adjustPoints.isPending || adjustStamps.isPending;

  const n = amount ?? 0;
  // One place turns the operation into the signed number the API takes.
  const delta = mode === "add" ? n : mode === "subtract" ? -n : n - currentBalance;
  const nextBalance = currentBalance + delta;

  const cap = CAP[currency];
  const noChange = amount !== undefined && delta === 0;
  const negative = nextBalance < 0;
  const overCap = Math.abs(delta) > cap;
  const problem = noChange
    ? t("adjust.noChange")
    : negative
      ? t("adjust.wouldGoNegative")
      : overCap
        ? t("adjust.overCap", { max: format.number(cap) })
        : null;

  const valid =
    amount !== undefined && Number.isInteger(n) && !problem && reason.trim().length > 0;

  const reset = () => {
    setMode("add");
    setAmount(undefined);
    setReason("");
  };

  /** Everything that can show this balance or the row we just wrote. */
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.customers.timeline.queryFilter()),
      queryClient.invalidateQueries(trpc.customers.pointsLedger.queryFilter()),
      queryClient.invalidateQueries(trpc.customers.stampsHistory.queryFilter()),
      queryClient.invalidateQueries(trpc.points.summaryForCustomer.queryFilter()),
      queryClient.invalidateQueries(trpc.stamps.walletForCustomer.queryFilter()),
    ]);
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const trimmed = reason.trim();

    if (currency === "points") {
      adjustPoints.mutate(
        { customerId, points: delta, reason: trimmed },
        {
          onSuccess: async (res) => {
            await invalidate();
            toast.success(t("adjust.okPoints", { balance: res.balance }));
            close();
          },
          onError: () => toast.error(t("adjust.error")),
        },
      );
      return;
    }

    adjustStamps.mutate(
      { customerId, stamps: delta, reason: trimmed },
      {
        onSuccess: async (res) => {
          await invalidate();
          toast.success(t("adjust.okStamps", { balance: res.wallet.currentStamps }));
          close();
        },
        onError: () => toast.error(t("adjust.error")),
      },
    );
  };

  const unit = currency === "points" ? t("adjust.unitPoints") : t("adjust.unitStamps");
  const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${format.number(Math.abs(v))}`;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <ResponsiveModalContent overlayClassName="bg-black/50 supports-backdrop-filter:backdrop-blur-sm">
        <form onSubmit={onSubmit}>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>
              {currency === "points" ? t("adjust.points") : t("adjust.stamps")}
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className="space-y-4 px-4 pb-2">
            <SegmentedControl<Mode>
              aria-label={t("adjust.modeLabel")}
              value={mode}
              onValueChange={setMode}
              options={[
                { value: "add", label: t("adjust.modeAdd"), icon: Plus },
                { value: "subtract", label: t("adjust.modeSubtract"), icon: Minus },
                { value: "set", label: t("adjust.modeSet"), icon: Equal },
              ]}
            />

            <div className="space-y-2">
              <label className="block text-sm font-semibold" htmlFor="adjust-amount">
                {mode === "set" ? t("adjust.targetLabel", { unit }) : t("adjust.amountLabel", { unit })}
              </label>
              <NumberInput
                id="adjust-amount"
                className="h-10"
                placeholder="0"
                // `NumberInput` defaults to an English comma. Everywhere else in
                // admin that is invisible, but here the typed number sits two
                // lines above the same number formatted by next-intl, and "1,200"
                // over "1200" reads like a discrepancy in a dialog whose whole
                // job is making the arithmetic obvious.
                thousandSeparator={sep.group}
                decimalSeparator={sep.decimal}
                value={amount ?? null}
                onValueChange={setAmount}
                autoFocus
              />
            </div>

            {/* The arithmetic, done for them. This is the whole point of the
                screen: the operator should never be computing the result. */}
            <dl className="bg-muted/40 border-border space-y-1.5 rounded-xl border p-3 text-sm">
              <Line label={t("adjust.currentBalance")} value={format.number(currentBalance)} />
              <Line
                label={t("adjust.change")}
                value={amount === undefined ? "—" : signed(delta)}
                tone={delta > 0 ? "up" : delta < 0 ? "down" : undefined}
              />
              <div className="border-border/70 border-t pt-1.5">
                <Line
                  label={t("adjust.newBalance")}
                  value={amount === undefined ? "—" : format.number(nextBalance)}
                  strong
                  tone={negative ? "bad" : undefined}
                />
              </div>
            </dl>

            {problem ? (
              <p className="text-destructive text-sm font-semibold">{problem}</p>
            ) : null}

            <div className="space-y-2">
              <label className="block text-sm font-semibold" htmlFor="adjust-reason">
                {t("adjust.reasonLabel")}
              </label>
              <Textarea
                id="adjust-reason"
                className="min-h-16"
                placeholder={t("adjust.reasonPlaceholder")}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
              />
              <p className="text-muted-foreground text-xs">{t("adjust.hint")}</p>
            </div>
          </div>

          <ResponsiveModalFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full px-5"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              className="h-10 rounded-full px-6 font-semibold"
              disabled={!valid || pending}
            >
              {t("adjust.confirm")}
            </Button>
          </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

function Line({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "up" | "down" | "bad";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={cn("text-muted-foreground", strong && "text-foreground font-semibold")}>
        {label}
      </dt>
      <dd
        className={cn(
          "tabular-nums",
          strong ? "text-base font-bold" : "font-semibold",
          tone === "up" && "text-emerald-600 dark:text-emerald-400",
          tone === "down" && "text-amber-600 dark:text-amber-400",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
