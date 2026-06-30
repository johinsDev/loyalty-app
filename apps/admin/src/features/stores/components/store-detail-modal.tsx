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

import { StoreDetailView } from "./store-detail-view";

/**
 * Intercepted store detail — shown as a ResponsiveModal over the list. Closing
 * navigates back (the URL was `/stores/<id>`). On a hard load the real
 * `/stores/[id]` page renders the full detail instead. Mirrors `PurchaseModal`.
 */
export function StoreDetailModal({ id }: { id: string }) {
  const router = useRouter();
  const t = useTranslations("Stores");
  const trpc = useTRPC();
  const { data: store } = useQuery(trpc.stores.get.queryOptions({ id }));

  return (
    <ResponsiveModal open onOpenChange={(open) => !open && router.back()}>
      <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md" desktopClassName="sm:max-w-lg">
        <ResponsiveModalTitle className="sr-only">{t("title")}</ResponsiveModalTitle>
        {store ? (
          <StoreDetailView store={store} variant="modal" />
        ) : (
          <div className="flex flex-col gap-4 p-1">
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="h-40 w-full rounded-3xl" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
