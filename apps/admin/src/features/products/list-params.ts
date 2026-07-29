import type { AppRouter } from "@loyalty/api";
import type { inferRouterInputs } from "@trpc/server";
import {
  createLoader,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import { tableParsers, VIEW_MODES } from "@/components/data-table";

type MenuAdminListInput = inferRouterInputs<AppRouter>["menu"]["adminList"];

export const PRODUCT_STATUS_VALUES = ["active", "draft", "archived"] as const;

/** Products default to the grid (image-first) view, unlike the list-default
 *  tables; everything else reuses the shared table parsers. */
const productsView = parseAsStringLiteral(VIEW_MODES).withDefault("grid");

/** Full nuqs parser map for the products list URL (table state + facets).
 *  Shared by the client toolbar and the RSC loader so both derive the same input.
 *  `status` defaults to active+draft so archived products stay hidden until asked
 *  for (matches the prior client-filtered UX). `category` holds category ids. */
export const productsSearchParams = {
  q: tableParsers.q,
  page: tableParsers.page,
  perPage: tableParsers.perPage,
  sort: tableParsers.sort,
  view: productsView,
  cols: tableParsers.cols,
  status: parseAsArrayOf(parseAsString).withDefault(["active", "draft"]),
  category: parseAsArrayOf(parseAsString).withDefault([]),
};

export type ProductsSearchValues = {
  q: string;
  page: number;
  perPage: number;
  sort: { id: string; desc: boolean }[];
  status: string[];
  category: string[];
};

/** The only filter params (excludes page/sort/view/cols) — feeds the page's
 *  filter-keyed Suspense so the skeleton re-flashes on a filter change. */
export const PRODUCTS_FILTER_KEYS = ["q", "status", "category"] as const;

/** Derive the server list input from the parsed URL values. The BE takes a
 *  single-column `sort` enum + `dir`; map the first name/price sort rule onto it
 *  (default: updated desc). `status`/`category` pass through when narrowed. */
export function buildProductsInput(v: ProductsSearchValues): MenuAdminListInput {
  const rule = v.sort.find((r) => r.id === "name" || r.id === "price");
  const sort = (rule?.id ?? "updated") as "name" | "price" | "updated";
  const dir = rule ? (rule.desc ? "desc" : "asc") : "desc";
  return {
    search: v.q || undefined,
    status: v.status.length ? (v.status as MenuAdminListInput["status"]) : undefined,
    categoryId: v.category.length ? v.category : undefined,
    sort,
    dir,
    page: v.page,
    perPage: v.perPage,
  };
}

/** RSC: parse the request searchParams into the typed values. */
export const loadProductsSearchParams = createLoader(productsSearchParams);
