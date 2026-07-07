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

import { CampaignDetailView } from "./campaign-detail-view";

/**
 * Quick-view campaign detail as a ResponsiveModal over the list, driven by the
 * `?detalle=<id>` URL param. A hard load of `/campaigns/[id]` renders the full
 * page instead.
 */
export function CampaignDetailModal({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("Campaigns");
  const trpc = useTRPC();
  const { data } = useQuery({
    ...trpc.campaigns.detail.queryOptions({ id: id ?? "" }),
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
          <CampaignDetailView campaign={data} variant="modal" />
        ) : (
          <div className="flex flex-col gap-4 p-5">
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
