import type { PurchasesAdminListInput } from "@loyalty/api/features/purchases/schemas";
import { endOfDay } from "@loyalty/date";
import {
  createLoader,
  parseAsArrayOf,
  parseAsInteger,
  parseAsIsoDate,
  parseAsString,
} from "nuqs/server";

import { tableParsers } from "@/components/data-table";

export const EFFECTIVENESS_VALUES = ["promo", "reward", "full"] as const;
export const REDEMPTION_CURRENCY_VALUES = ["stamps", "points"] as const;
export const ENTRY_SOURCE_VALUES = ["campaign", "shortlink", "organic"] as const;

/** Full nuqs parser map for the purchases list URL (table state + facets).
 *  Shared by the client view and the RSC loader so both derive the same input. */
export const purchasesSearchParams = {
  q: tableParsers.q,
  page: tableParsers.page,
  perPage: tableParsers.perPage,
  sort: tableParsers.sort,
  view: tableParsers.view,
  cols: tableParsers.cols,
  store: parseAsArrayOf(parseAsString).withDefault([]),
  cashier: parseAsArrayOf(parseAsString).withDefault([]),
  effectiveness: parseAsArrayOf(parseAsString).withDefault([]),
  currency: parseAsArrayOf(parseAsString).withDefault([]),
  entry: parseAsArrayOf(parseAsString).withDefault([]),
  /** Deep-link from a customer profile ("their purchases"). */
  customer: parseAsString,
  amountMin: parseAsInteger,
  amountMax: parseAsInteger,
  from: parseAsIsoDate,
  to: parseAsIsoDate,
};

export type PurchasesSearchValues = {
  q: string;
  page: number;
  perPage: number;
  sort: { id: string; desc: boolean }[];
  store: string[];
  cashier: string[];
  effectiveness: string[];
  currency: string[];
  entry: string[];
  customer: string | null;
  amountMin: number | null;
  amountMax: number | null;
  from: Date | null;
  to: Date | null;
};

/** Keep only known values; all-checked (or none) → no filter. */
function facet<T extends string>(values: string[], all: readonly T[]): T[] | undefined {
  const picked = values.filter((v): v is T => (all as readonly string[]).includes(v));
  return picked.length > 0 && picked.length < all.length ? picked : undefined;
}

/** Derive the server list input from the parsed URL values (`to` is taken to
 *  end-of-day so the range is inclusive). Store/cashier are free-form id sets
 *  (any picked = a filter), not fixed enums. */
export function buildPurchasesInput(v: PurchasesSearchValues): PurchasesAdminListInput {
  return {
    q: v.q || undefined,
    page: v.page,
    perPage: v.perPage,
    sort: v.sort,
    storeIds: v.store.length > 0 ? v.store : undefined,
    cashierIds: v.cashier.length > 0 ? v.cashier : undefined,
    customerId: v.customer ?? undefined,
    effectiveness: facet(v.effectiveness, EFFECTIVENESS_VALUES),
    redemptionCurrency: facet(v.currency, REDEMPTION_CURRENCY_VALUES),
    entrySource: facet(v.entry, ENTRY_SOURCE_VALUES),
    amountMin: v.amountMin ?? undefined,
    amountMax: v.amountMax ?? undefined,
    dateFrom: v.from ?? undefined,
    dateTo: v.to ? endOfDay(v.to) : undefined,
  };
}

/** RSC: parse the request searchParams into the typed values. */
export const loadPurchasesSearchParams = createLoader(purchasesSearchParams);
