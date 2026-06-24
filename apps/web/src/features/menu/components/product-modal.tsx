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

import { ProductDetail } from "./product-detail";

/**
 * Intercepted product detail — shown as a ResponsiveModal over the menu. Closing
 * navigates back (the URL was `/product/<slug>`). On a hard load the real
 * `/product/[slug]` page renders instead (SEO).
 */
export function ProductModal({ slug }: { slug: string }) {
  const router = useRouter();
  const trpc = useTRPC();
  const { data: product } = useQuery(
    trpc.menu.productBySlug.queryOptions({ slug }),
  );

  return (
    <ResponsiveModal open onOpenChange={(open) => !open && router.back()}>
      <ResponsiveModalContent
        mobileClassName="mx-auto w-full max-w-md h-[90dvh] data-[vaul-drawer-direction=bottom]:max-h-[90dvh]"
        desktopClassName="sm:max-w-2xl"
        showCloseButton={false}
      >
        <ResponsiveModalTitle className="sr-only">
          {product?.name ?? "Producto"}
        </ResponsiveModalTitle>
        {product ? (
          <ProductDetail product={product} />
        ) : (
          <div className="flex flex-col gap-4 p-4">
            <Skeleton className="aspect-square w-full rounded-3xl" />
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
