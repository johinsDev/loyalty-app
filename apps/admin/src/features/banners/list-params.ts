import type { BannersListInput } from "@loyalty/api/features/banners/schemas";
import { endOfDay } from "@loyalty/date";
import { createLoader, parseAsArrayOf, parseAsIsoDate, parseAsString } from "nuqs/server";

import { tableParsers } from "@/components/data-table";

const STATE_VALUES = ["draft", "scheduled", "active", "expired"] as const;
type BannerState = (typeof STATE_VALUES)[number];

/** Full nuqs parser map for the banners list URL (table state + facets). Shared
 *  by the client view and the RSC loader so both derive the same query input. */
export const bannersSearchParams = {
  q: tableParsers.q,
  page: tableParsers.page,
  perPage: tableParsers.perPage,
  sort: tableParsers.sort,
  view: tableParsers.view,
  cols: tableParsers.cols,
  state: parseAsArrayOf(parseAsString).withDefault([]),
  from: parseAsIsoDate,
  to: parseAsIsoDate,
};

export type BannersSearchValues = {
  q: string;
  page: number;
  perPage: number;
  sort: { id: string; desc: boolean }[];
  state: string[];
  from: Date | null;
  to: Date | null;
};

/** Derive the server list input from the parsed URL values (all states checked
 *  → no filter; `to` is taken to end-of-day so the range is inclusive). */
export function buildBannersInput(v: BannersSearchValues): BannersListInput {
  return {
    q: v.q || undefined,
    page: v.page,
    perPage: v.perPage,
    sort: v.sort,
    state:
      v.state.length > 0 && v.state.length < STATE_VALUES.length
        ? (v.state as BannerState[])
        : undefined,
    createdFrom: v.from ?? undefined,
    createdTo: v.to ? endOfDay(v.to) : undefined,
  };
}

/** RSC: parse the request searchParams into the typed values. */
export const loadBannersSearchParams = createLoader(bannersSearchParams);
