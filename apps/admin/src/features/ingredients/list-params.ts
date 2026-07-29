import type { AppRouter } from "@loyalty/api";
import type { inferRouterInputs } from "@trpc/server";
import {
  createLoader,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
} from "nuqs/server";

import { tableParsers } from "@/components/data-table";

type IngredientsListInput = inferRouterInputs<AppRouter>["ingredients"]["adminList"];

/** Archived ingredients stay hidden until asked for — an archived one is by
 *  definition retired from the pickers. */
export const ingredientsSearchParams = {
  q: tableParsers.q,
  page: tableParsers.page,
  perPage: tableParsers.perPage,
  sort: tableParsers.sort,
  cols: tableParsers.cols,
  category: parseAsArrayOf(parseAsString).withDefault([]),
  unit: parseAsArrayOf(parseAsString).withDefault([]),
  archived: parseAsBoolean.withDefault(false),
};

export type IngredientsSearchValues = {
  q: string;
  page: number;
  perPage: number;
  sort: { id: string; desc: boolean }[];
  category: string[];
  unit: string[];
  archived: boolean;
};

export const INGREDIENTS_FILTER_KEYS = ["q", "category", "unit", "archived"] as const;

export function buildIngredientsInput(v: IngredientsSearchValues): IngredientsListInput {
  return {
    q: v.q || undefined,
    page: v.page,
    perPage: v.perPage,
    sort: v.sort,
    categoryId: v.category,
    unit: v.unit,
    includeArchived: v.archived,
  };
}

export const loadIngredientsSearchParams = createLoader(ingredientsSearchParams);
