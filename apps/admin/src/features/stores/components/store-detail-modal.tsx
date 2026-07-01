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

import { StoreDetailView } from "./store-detail-view";

/**
 * Quick-view store detail as a ResponsiveModal over the list, driven by the
 * `?detalle=<id>` URL param (shareable, no intercepting routes). A hard load of
 * `/stores/[id]` renders the full page instead.
 */
export function StoreDetailModal({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("Stores");
  const trpc = useTRPC();
  const { data } = useQuery({
    ...trpc.stores.get.queryOptions({ id: id ?? "" }),
    enabled: !!id,
  });

  return (
    <ResponsiveModal open={!!id} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveModalContent
        showCloseButton={false}
        mobileClassName="mx-auto w-full max-w-md"
        desktopClassName="sm:max-w-lg"
      >
        <ResponsiveModalTitle className="sr-only">{t("title")}</ResponsiveModalTitle>
        {id && data ? (
          <StoreDetailView store={data} variant="modal" />
        ) : (
          <div className="flex flex-col gap-4 p-5">
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
