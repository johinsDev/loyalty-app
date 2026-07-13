"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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

import { useRouter } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

/** Owner-only ban. Revokes the customer's sessions immediately, so it takes a
 *  mandatory reason (surfaced back to them in the PWA). Destructive. */
export function BanCustomerDialog({
  customerId,
  name,
  open,
  onOpenChange,
}: {
  customerId: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Customers");
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const ban = useMutation(trpc.customers.ban.mutationOptions());
  const valid = reason.trim().length > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    ban.mutate(
      { customerId, reason: reason.trim() },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries(trpc.customers.adminList.queryFilter());
          toast.success(t("ban.ok", { name }));
          setReason("");
          onOpenChange(false);
          router.refresh();
        },
        onError: () => toast.error(t("ban.error")),
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
            <ResponsiveModalTitle>{t("ban.title", { name })}</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className="space-y-3 px-4 pb-2">
            <p className="text-muted-foreground text-sm">{t("ban.hint")}</p>
            <div className="space-y-2">
              <label className="block text-sm font-semibold" htmlFor="ban-reason">
                {t("ban.reasonLabel")}
              </label>
              <Textarea
                id="ban-reason"
                className="min-h-16"
                placeholder={t("ban.reasonPlaceholder")}
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
              disabled={!valid || ban.isPending}
            >
              {t("ban.confirm")}
            </Button>
          </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

/** Owner-only unban. No reason needed — a plain confirm. */
export function UnbanCustomerDialog({
  customerId,
  name,
  open,
  onOpenChange,
}: {
  customerId: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Customers");
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  const unban = useMutation(trpc.customers.unban.mutationOptions());

  const onConfirm = () => {
    unban.mutate(
      { customerId },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries(trpc.customers.adminList.queryFilter());
          toast.success(t("ban.unbanOk", { name }));
          onOpenChange(false);
          router.refresh();
        },
        onError: () => toast.error(t("ban.unbanError")),
      },
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("ban.unbanTitle", { name })}</AlertDialogTitle>
          <AlertDialogDescription>{t("ban.unbanDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-10 px-4">{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={unban.isPending}
            className="h-10 px-4"
          >
            {t("ban.unbanConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
