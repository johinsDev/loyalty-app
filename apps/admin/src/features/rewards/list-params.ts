import type { RewardAdminListInput } from "@loyalty/api/features/rewards/schemas";
import { createLoader, parseAsArrayOf, parseAsString } from "nuqs/server";

import { tableParsers } from "@/components/data-table";

export const REWARD_STATUS_VALUES = ["draft", "published", "archived"] as const;
export const REWARD_TYPE_VALUES = [
  "freeProduct",
  "amountOff",
  "percentOff",
  "experience",
] as const;

/** Full nuqs parser map for the rewards list URL (table state + facets).
 *  Shared by the client view and the RSC loader so both derive the same input. */
export const rewardsSearchParams = {
  q: tableParsers.q,
  page: tableParsers.page,
  perPage: tableParsers.perPage,
  sort: tableParsers.sort,
  view: tableParsers.view,
  cols: tableParsers.cols,
  status: parseAsArrayOf(parseAsString).withDefault([]),
  type: parseAsArrayOf(parseAsString).withDefault([]),
};

export type RewardsSearchValues = {
  q: string;
  page: number;
  perPage: number;
  sort: { id: string; desc: boolean }[];
  status: string[];
  type: string[];
};

/** Keep only known values; all-checked (or none) → no filter. */
function facet<T extends string>(values: string[], all: readonly T[]): T[] | undefined {
  const picked = values.filter((v): v is T => (all as readonly string[]).includes(v));
  return picked.length > 0 && picked.length < all.length ? picked : undefined;
}

/** Derive the server list input from the parsed URL values. */
export function buildRewardsInput(v: RewardsSearchValues): RewardAdminListInput {
  return {
    q: v.q || undefined,
    page: v.page,
    perPage: v.perPage,
    sort: v.sort,
    status: facet(v.status, REWARD_STATUS_VALUES),
    type: facet(v.type, REWARD_TYPE_VALUES),
  };
}

/** RSC: parse the request searchParams into the typed values. */
export const loadRewardsSearchParams = createLoader(rewardsSearchParams);
