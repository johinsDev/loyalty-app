"use client";

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle,
  Skeleton,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";

import { useRouter } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

import { PromoDetail } from "./promo-detail";

/** Intercepted promo detail — modal over the current page; full page on reload. */
export function PromoModal({ slug }: { slug: string }) {
  const router = useRouter();
  const trpc = useTRPC();
  const { data: promo } = useQuery(trpc.promociones.bySlug.queryOptions({ slug }));

  return (
    <ResponsiveModal open onOpenChange={(open) => !open && router.back()}>
      <ResponsiveModalContent
        mobileClassName="mx-auto w-full max-w-md h-[90dvh] data-[vaul-drawer-direction=bottom]:max-h-[90dvh]"
        desktopClassName="sm:max-w-2xl"
        showCloseButton={false}
      >
        <ResponsiveModalTitle className="sr-only">
          {promo?.name ?? "Promo"}
        </ResponsiveModalTitle>
        {promo ? (
          <PromoDetail promo={promo} />
        ) : (
          <div className="flex flex-col gap-4 p-4">
            <Skeleton className="h-56 w-full rounded-3xl" />
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-full" />
          </div>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
