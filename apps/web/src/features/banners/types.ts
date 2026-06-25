import type { AppRouter } from "@loyalty/api";
import type { inferRouterOutputs } from "@trpc/server";

// Type-only — derived from the router so client components never import values
// from @loyalty/api (which would drag in @trpc/server).
type RouterOutputs = inferRouterOutputs<AppRouter>;

export type BannerCardData = RouterOutputs["banners"]["homeBanners"][number];
export type BannerDetailData = NonNullable<RouterOutputs["banners"]["bySlug"]>;
