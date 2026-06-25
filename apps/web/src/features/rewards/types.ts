import type { AppRouter } from "@loyalty/api";
import type { inferRouterOutputs } from "@trpc/server";

// Type-only derivations from the live rewards router. Importing `AppRouter` as a
// type from `@loyalty/api` is erased at build time, so this never drags
// `@trpc/server` into the client bundle (the import-VALUES gotcha).
type RewardsOutputs = inferRouterOutputs<AppRouter>["rewards"];

export type RewardListItem = RewardsOutputs["list"]["items"][number];
export type RewardCurrency = RewardListItem["affordableWith"][number];

/** The catalog filters; a subset of the server `rewardFilterSchema` (the server
 *  still supports "canjeados", but redeemed rewards are surfaced via the
 *  "Canjeadas recientemente" section + history view, not a catalog chip). */
export const REWARD_FILTERS = ["all", "proximos", "listos"] as const;
