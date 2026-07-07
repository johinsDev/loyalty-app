import type { AdminListInput } from "@loyalty/api/features/promotions/schemas";
import { endOfDay } from "@loyalty/date";
import { createLoader, parseAsArrayOf, parseAsIsoDate, parseAsString } from "nuqs/server";

import { tableParsers } from "@/components/data-table";

export const PROMO_STATUS_VALUES = ["draft", "published", "archived"] as const;
export const PROMO_VIGENCY_VALUES = ["active", "scheduled", "expired"] as const;
export const PROMO_TYPE_VALUES = [
  "percentOff",
  "amountOff",
  "nxm",
  "secondUnit",
  "bundle",
  "combo",
  "crossSell",
  "cartThreshold",
  "volumeTiered",
  "pointsMultiplier",
] as const;
export const PROMO_AUDIENCE_VALUES = ["all", "tier", "specific"] as const;

/** Full nuqs parser map for the promotions list URL (table state + facets).
 *  Shared by the client view and the RSC loader so both derive the same input. */
export const promotionsSearchParams = {
  q: tableParsers.q,
  page: tableParsers.page,
  perPage: tableParsers.perPage,
  sort: tableParsers.sort,
  view: tableParsers.view,
  cols: tableParsers.cols,
  status: parseAsArrayOf(parseAsString).withDefault([]),
  vigency: parseAsArrayOf(parseAsString).withDefault([]),
  type: parseAsArrayOf(parseAsString).withDefault([]),
  audience: parseAsArrayOf(parseAsString).withDefault([]),
  startsFrom: parseAsIsoDate,
  startsTo: parseAsIsoDate,
};

export type PromotionsSearchValues = {
  q: string;
  page: number;
  perPage: number;
  sort: { id: string; desc: boolean }[];
  status: string[];
  vigency: string[];
  type: string[];
  audience: string[];
  startsFrom: Date | null;
  startsTo: Date | null;
};

/** Keep only known values; all-checked (or none) → no filter. */
function facet<T extends string>(values: string[], all: readonly T[]): T[] | undefined {
  const picked = values.filter((v): v is T => (all as readonly string[]).includes(v));
  return picked.length > 0 && picked.length < all.length ? picked : undefined;
}

/** Derive the server list input from the parsed URL values (`startsTo` is taken
 *  to end-of-day so the range is inclusive). */
export function buildPromotionsInput(v: PromotionsSearchValues): AdminListInput {
  return {
    q: v.q || undefined,
    page: v.page,
    perPage: v.perPage,
    sort: v.sort,
    status: facet(v.status, PROMO_STATUS_VALUES),
    vigency: facet(v.vigency, PROMO_VIGENCY_VALUES),
    type: facet(v.type, PROMO_TYPE_VALUES),
    audience: facet(v.audience, PROMO_AUDIENCE_VALUES),
    startsFrom: v.startsFrom ?? undefined,
    startsTo: v.startsTo ? endOfDay(v.startsTo) : undefined,
  };
}

/** RSC: parse the request searchParams into the typed values. */
export const loadPromotionsSearchParams = createLoader(promotionsSearchParams);
