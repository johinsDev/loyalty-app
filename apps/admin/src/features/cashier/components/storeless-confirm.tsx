"use client";

import {
  Button,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { Store } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * "Facturar sin tienda" guard. When no store is active in the register, a sale
 * still records (the server attributes it to a fallback store), but that's
 * rarely intended — this confirms it explicitly so the cashier notices the
 * missing store instead of silently mis-attributing revenue.
 */
export function StorelessConfirm({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("Cashier");
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
        <div className="flex flex-col px-6 pt-2 pb-6">
          <span className="bg-muted text-muted-foreground mb-3 grid size-14 place-items-center rounded-3xl">
            <Store className="size-6" />
          </span>
          <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
            {t("storelessTitle")}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-muted-foreground mt-2 text-sm leading-relaxed">
            {t("storelessBody")}
          </ResponsiveModalDescription>
          <div className="mt-6 flex gap-2">
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              className="h-10 flex-1 rounded-2xl font-bold"
            >
              {t("storelessCancel")}
            </Button>
            <Button
              variant="default"
              onClick={onConfirm}
              className="h-10 flex-1 rounded-2xl font-extrabold"
            >
              {t("storelessConfirm")}
            </Button>
          </div>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
