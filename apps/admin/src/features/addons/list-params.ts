import type { AppRouter } from "@loyalty/api";
import type { inferRouterInputs } from "@trpc/server";
import { createLoader, parseAsArrayOf, parseAsString } from "nuqs/server";

import { tableParsers } from "@/components/data-table";

type AddonsListInput = inferRouterInputs<AppRouter>["addons"]["adminList"];

/** Full nuqs parser map for the add-ons list URL (table state + facets).
 *  Shared by the client toolbar and the RSC loader so both derive the same
 *  input. Unlike products, nothing is hidden by default — an inactive add-on
 *  still matters to the person curating the catalog. */
export const addonsSearchParams = {
  q: tableParsers.q,
  page: tableParsers.page,
  perPage: tableParsers.perPage,
  sort: tableParsers.sort,
  cols: tableParsers.cols,
  category: parseAsArrayOf(parseAsString).withDefault([]),
  active: parseAsArrayOf(parseAsString).withDefault([]),
  linked: parseAsArrayOf(parseAsString).withDefault([]),
};

export type AddonsSearchValues = {
  q: string;
  page: number;
  perPage: number;
  sort: { id: string; desc: boolean }[];
  category: string[];
  active: string[];
  linked: string[];
};

/** Filter params only (excludes page/sort/cols) — feeds the filter-keyed
 *  Suspense so the skeleton re-flashes on a filter change but not on paging. */
export const ADDONS_FILTER_KEYS = ["q", "category", "active", "linked"] as const;

export function buildAddonsInput(v: AddonsSearchValues): AddonsListInput {
  return {
    q: v.q || undefined,
    page: v.page,
    perPage: v.perPage,
    sort: v.sort,
    categoryId: v.category,
    active: v.active as AddonsListInput["active"],
    linked: v.linked as AddonsListInput["linked"],
  };
}

export const loadAddonsSearchParams = createLoader(addonsSearchParams);
