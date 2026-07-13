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
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

/** One-off marketing blast to a single customer. Fans out through the
 *  notifications engine (`promo`), so per-channel marketing opt-outs apply. */
export function NotifyCustomerDialog({
  customerId,
  open,
  onOpenChange,
}: {
  customerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Customers");
  const trpc = useTRPC();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const send = useMutation(trpc.notifications.send.mutationOptions());
  const valid = title.trim().length > 0 && body.trim().length > 0;

  const reset = () => {
    setTitle("");
    setBody("");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    send.mutate(
      {
        customerIds: [customerId],
        notificationKey: "promo",
        payload: { title: title.trim(), body: body.trim() },
      },
      {
        onSuccess: () => {
          toast.success(t("notify.ok"));
          reset();
          onOpenChange(false);
        },
        onError: () => toast.error(t("notify.error")),
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
            <ResponsiveModalTitle>{t("notify.title")}</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className="space-y-3 px-4 pb-2">
            <p className="text-muted-foreground text-sm">{t("notify.hint")}</p>
            <div className="space-y-2">
              <label className="block text-sm font-semibold" htmlFor="notify-title">
                {t("notify.titleLabel")}
              </label>
              <Input
                id="notify-title"
                className="h-10"
                placeholder={t("notify.titlePlaceholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold" htmlFor="notify-body">
                {t("notify.bodyLabel")}
              </label>
              <Textarea
                id="notify-body"
                className="min-h-20"
                placeholder={t("notify.bodyPlaceholder")}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={300}
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
              disabled={!valid || send.isPending}
            >
              {t("notify.confirm")}
            </Button>
          </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
