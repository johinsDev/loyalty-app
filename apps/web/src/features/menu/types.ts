import type { AppRouter } from "@loyalty/api";
import type { inferRouterOutputs } from "@trpc/server";

// Type-only — derived from the router so client components never import values
// from @loyalty/api (which would drag in @trpc/server).
type RouterOutputs = inferRouterOutputs<AppRouter>;

export type MenuCard = RouterOutputs["menu"]["list"]["items"][number];
export type ProductDetailData = NonNullable<
  RouterOutputs["menu"]["productBySlug"]
>;
export type SectionView = RouterOutputs["menu"]["sections"][number];
