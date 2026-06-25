import type { AppRouter } from "@loyalty/api";
import type { inferRouterOutputs } from "@trpc/server";

// Type-only — derived from the router so client components never import values
// from @loyalty/api.
type RouterOutputs = inferRouterOutputs<AppRouter>;

export type PromoCardData = RouterOutputs["promociones"]["homePromos"][number];
export type PromoDetailData = NonNullable<RouterOutputs["promociones"]["bySlug"]>;
