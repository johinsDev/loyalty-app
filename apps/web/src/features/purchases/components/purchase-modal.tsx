"use client";

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle,
  Skeleton,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

import { PurchaseDetailView } from "./purchase-detail-view";

/**
 * Intercepted purchase detail — shown as a ResponsiveModal over the list.
 * Closing navigates back (the URL was `/compras/<id>`). On a hard load the real
 * `/compras/[id]` page renders the full detail instead. Mirrors `BannerModal`.
 */
export function PurchaseModal({ id }: { id: string }) {
  const router = useRouter();
  const t = useTranslations("Purchases");
  const trpc = useTRPC();
  const { data: detail } = useQuery(
    trpc.purchases.purchaseDetail.queryOptions({ id }),
  );

  return (
    <ResponsiveModal open onOpenChange={(open) => !open && router.back()}>
      <ResponsiveModalContent
        mobileClassName="mx-auto w-full max-w-md"
        desktopClassName="sm:max-w-md"
      >
        <ResponsiveModalTitle className="sr-only">
          {t("title")}
        </ResponsiveModalTitle>
        {detail ? (
          <PurchaseDetailView detail={detail} variant="modal" />
        ) : (
          <div className="flex flex-col gap-4 p-4">
            <Skeleton className="mx-auto h-8 w-1/3" />
            <Skeleton className="h-4 w-2/3 self-center" />
            <Skeleton className="mt-4 h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="mt-4 h-20 w-full rounded-2xl" />
          </div>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
