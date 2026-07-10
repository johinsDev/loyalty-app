"use client";

import {
  Button,
  Input,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  Textarea,
} from "@loyalty/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

export type LoyaltyCurrency = "points" | "stamps";

/** Owner-only manual correction of a customer's balance, with no purchase
 *  attached. Writes a signed ledger row (visible in Loyalty + Activity) and an
 *  audit entry. `stamps` is capped at ±100 and `points` at ±100k server-side. */
export function AdjustLoyaltyDialog({
  customerId,
  currency,
  open,
  onOpenChange,
}: {
  customerId: string;
  currency: LoyaltyCurrency;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Customers");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const adjustPoints = useMutation(trpc.points.adjustForCustomer.mutationOptions());
  const adjustStamps = useMutation(trpc.stamps.adjustForCustomer.mutationOptions());
  const pending = adjustPoints.isPending || adjustStamps.isPending;

  const delta = Number(amount);
  const valid = Number.isInteger(delta) && delta !== 0 && reason.trim().length > 0;

  const reset = () => {
    setAmount("");
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

  const title = currency === "points" ? t("adjust.points") : t("adjust.stamps");

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
            <ResponsiveModalTitle>{title}</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className="space-y-3 px-4 pb-2">
            <p className="text-muted-foreground text-sm">{t("adjust.hint")}</p>
            <div className="space-y-2">
              <label className="block text-sm font-semibold" htmlFor="adjust-amount">
                {t("adjust.amountLabel")}
              </label>
              <Input
                id="adjust-amount"
                type="number"
                inputMode="numeric"
                className="h-10"
                placeholder={t("adjust.amountPlaceholder")}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>
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
