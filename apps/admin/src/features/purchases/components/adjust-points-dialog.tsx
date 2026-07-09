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

/** Owner-only correction of a purchase's points (e.g. the scanner failed).
 *  Writes a signed `adjust` ledger row tied to the purchase (shows in the
 *  timeline) and refreshes the detail. */
export function AdjustPointsDialog({
  purchaseId,
  open,
  onOpenChange,
}: {
  purchaseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Purchases");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");

  const adjust = useMutation(trpc.points.adjustForPurchase.mutationOptions());

  const delta = Number(points);
  const valid = Number.isInteger(delta) && delta !== 0 && reason.trim().length > 0;

  const reset = () => {
    setPoints("");
    setReason("");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    adjust.mutate(
      { purchaseId, points: delta, reason: reason.trim() },
      {
        onSuccess: async (res) => {
          await queryClient.invalidateQueries(trpc.purchases.adminGet.queryFilter());
          toast.success(t("adjustOk", { balance: res.balance }));
          reset();
          onOpenChange(false);
        },
        onError: () => toast.error(t("adjustError")),
      },
    );
  };

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
            <ResponsiveModalTitle>{t("adjustTitle")}</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className="space-y-3 px-4 pb-2">
            <p className="text-muted-foreground text-sm">{t("adjustHint")}</p>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold" htmlFor="adjust-points">
                {t("adjustPointsLabel")}
              </label>
              <Input
                id="adjust-points"
                type="number"
                inputMode="numeric"
                className="h-10"
                placeholder={t("adjustPointsPlaceholder")}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold" htmlFor="adjust-reason">
                {t("adjustReasonLabel")}
              </label>
              <Textarea
                id="adjust-reason"
                className="min-h-16"
                placeholder={t("adjustReasonPlaceholder")}
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
              disabled={!valid || adjust.isPending}
            >
              {t("adjustConfirm")}
            </Button>
          </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
