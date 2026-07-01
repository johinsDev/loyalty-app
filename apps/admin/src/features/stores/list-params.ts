import type { StoresListInput } from "@loyalty/api/features/stores/schemas";
import { endOfDay } from "@loyalty/date";
import { createLoader, parseAsArrayOf, parseAsIsoDate, parseAsString } from "nuqs/server";

import { tableParsers } from "@/components/data-table";

const STATUS_VALUES = ["draft", "published"] as const;

/** Full nuqs parser map for the stores list URL (table state + facets). Shared
 *  by the client view and the RSC loader so both derive the same query input. */
export const storesSearchParams = {
  q: tableParsers.q,
  page: tableParsers.page,
  perPage: tableParsers.perPage,
  sort: tableParsers.sort,
  view: tableParsers.view,
  cols: tableParsers.cols,
  status: parseAsArrayOf(parseAsString).withDefault([]),
  visible: parseAsString,
  primary: parseAsString,
  from: parseAsIsoDate,
  to: parseAsIsoDate,
};

export type StoresSearchValues = {
  q: string;
  page: number;
  perPage: number;
  sort: { id: string; desc: boolean }[];
  status: string[];
  visible: string | null;
  primary: string | null;
  from: Date | null;
  to: Date | null;
};

/** Derive the server list input from the parsed URL values (facets "all" → no
 *  filter; `to` is taken to end-of-day so the range is inclusive). */
export function buildStoresInput(v: StoresSearchValues): StoresListInput {
  return {
    q: v.q || undefined,
    page: v.page,
    perPage: v.perPage,
    sort: v.sort,
    status:
      v.status.length > 0 && v.status.length < STATUS_VALUES.length
        ? (v.status as ("draft" | "published")[])
        : undefined,
    visible: v.visible === "true" ? [true] : v.visible === "false" ? [false] : undefined,
    primary: v.primary === "primary" || v.primary === "secondary" ? v.primary : undefined,
    createdFrom: v.from ?? undefined,
    createdTo: v.to ? endOfDay(v.to) : undefined,
  };
}

/** RSC: parse the request searchParams into the typed values. */
export const loadStoresSearchParams = createLoader(storesSearchParams);
