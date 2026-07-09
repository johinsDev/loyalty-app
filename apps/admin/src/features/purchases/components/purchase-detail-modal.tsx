"use client";

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle,
  Skeleton,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/lib/trpc/client";

import { PurchaseDetailView } from "./purchase-detail-view";

/**
 * Quick-view purchase "radiografía" as a ResponsiveModal over the list, driven
 * by the `?detalle=<id>` URL param (shareable, no intercepting routes). A hard
 * load of `/purchases/[id]` renders the full page instead.
 */
export function PurchaseDetailModal({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("Purchases");
  const trpc = useTRPC();
  const { data } = useQuery({
    ...trpc.purchases.adminGet.queryOptions({ id: id ?? "" }),
    enabled: !!id,
  });

  return (
    <ResponsiveModal open={!!id} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveModalContent
        showCloseButton={false}
        mobileClassName="mx-auto w-full max-w-md"
        desktopClassName="sm:max-w-lg"
      >
        <ResponsiveModalTitle className="sr-only">{t("receipt")}</ResponsiveModalTitle>
        {id && data ? (
          <PurchaseDetailView detail={data} variant="modal" />
        ) : (
          <div className="flex flex-col gap-4 p-5">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
