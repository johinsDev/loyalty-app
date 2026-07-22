"use client";

import {
  Button,
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

import { useRouter } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

/** Owner-only void (anulación). Reverses the sale's loyalty (stamp, points,
 *  reward) and marks it voided with a mandatory reason. Destructive. */
export function VoidPurchaseDialog({
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const voidMut = useMutation(trpc.purchases.voidPurchase.mutationOptions());
  const valid = reason.trim().length > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    voidMut.mutate(
      { id: purchaseId, reason: reason.trim() },
      {
        onSuccess: async () => {
          await Promise.all([
            queryClient.invalidateQueries(trpc.purchases.adminList.queryFilter()),
            queryClient.invalidateQueries(trpc.purchases.adminKpis.queryFilter()),
          ]);
          toast.success(t("voidOk"));
          setReason("");
          onOpenChange(false);
          router.refresh();
        },
        onError: () => toast.error(t("voidError")),
      },
    );
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => {
        if (!o) setReason("");
        onOpenChange(o);
      }}
    >
      <ResponsiveModalContent overlayClassName="bg-black/50 supports-backdrop-filter:backdrop-blur-sm">
        <form onSubmit={onSubmit}>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{t("voidTitle")}</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className="space-y-3 px-4 pb-2">
            <p className="text-muted-foreground text-sm">{t("voidHint")}</p>
            <div className="space-y-2">
              <label className="block text-sm font-semibold" htmlFor="void-reason">
                {t("voidReasonLabel")}
              </label>
              <Textarea
                id="void-reason"
                className="min-h-16"
                placeholder={t("voidReasonPlaceholder")}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
                autoFocus
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 rounded-full px-6 font-semibold"
              disabled={!valid || voidMut.isPending}
            >
              {t("voidConfirm")}
            </Button>
          </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
