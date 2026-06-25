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

import { BannerDetail } from "./banner-detail";

/**
 * Intercepted banner detail — shown as a ResponsiveModal over the home. Closing
 * navigates back (the URL was `/banner/<slug>`). On a hard load the real
 * `/banner/[slug]` page renders instead (SEO). Only banners without a CTA reach
 * this (CTA banners link straight to their target).
 */
export function BannerModal({ slug }: { slug: string }) {
  const router = useRouter();
  const trpc = useTRPC();
  const { data: banner } = useQuery(trpc.banners.bySlug.queryOptions({ slug }));

  return (
    <ResponsiveModal open onOpenChange={(open) => !open && router.back()}>
      <ResponsiveModalContent
        mobileClassName="mx-auto w-full max-w-md h-[90dvh] data-[vaul-drawer-direction=bottom]:max-h-[90dvh]"
        desktopClassName="sm:max-w-2xl"
        showCloseButton={false}
      >
        <ResponsiveModalTitle className="sr-only">
          {banner?.name ?? "Banner"}
        </ResponsiveModalTitle>
        {banner ? (
          <BannerDetail banner={banner} />
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
