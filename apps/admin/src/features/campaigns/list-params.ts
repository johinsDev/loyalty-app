import type {
  CampaignDisplayState,
  CampaignsListInput,
} from "@loyalty/api/features/campaigns/schemas";
import { endOfDay } from "@loyalty/date";
import { createLoader, parseAsArrayOf, parseAsIsoDate, parseAsString } from "nuqs/server";

import { tableParsers } from "@/components/data-table";

const TYPE_VALUES = ["promotional", "automated", "transactional"] as const;
type CampaignType = (typeof TYPE_VALUES)[number];

const STATE_VALUES = ["draft", "scheduled", "sending", "sent", "paused"] as const;

/** Full nuqs parser map for the campaigns list URL (table state + facets).
 *  Shared by the client view and the RSC loader so both derive the same input. */
export const campaignsSearchParams = {
  q: tableParsers.q,
  page: tableParsers.page,
  perPage: tableParsers.perPage,
  sort: tableParsers.sort,
  view: tableParsers.view,
  cols: tableParsers.cols,
  type: parseAsArrayOf(parseAsString).withDefault([]),
  state: parseAsArrayOf(parseAsString).withDefault([]),
  from: parseAsIsoDate,
  to: parseAsIsoDate,
};

export type CampaignsSearchValues = {
  q: string;
  page: number;
  perPage: number;
  sort: { id: string; desc: boolean }[];
  type: string[];
  state: string[];
  from: Date | null;
  to: Date | null;
};

/** Derive the server list input from the parsed URL values (all facets checked
 *  → no filter; `to` is taken to end-of-day so the range is inclusive). */
export function buildCampaignsInput(v: CampaignsSearchValues): CampaignsListInput {
  return {
    q: v.q || undefined,
    page: v.page,
    perPage: v.perPage,
    sort: v.sort,
    type:
      v.type.length > 0 && v.type.length < TYPE_VALUES.length
        ? (v.type as CampaignType[])
        : undefined,
    state:
      v.state.length > 0 && v.state.length < STATE_VALUES.length
        ? (v.state as CampaignDisplayState[])
        : undefined,
    createdFrom: v.from ?? undefined,
    createdTo: v.to ? endOfDay(v.to) : undefined,
  };
}

/** RSC: parse the request searchParams into the typed values. */
export const loadCampaignsSearchParams = createLoader(campaignsSearchParams);
