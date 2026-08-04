import type { AdminAlertsListInput } from "@loyalty/api/features/admin-notifications/schemas";
import { endOfDay } from "@loyalty/date";
import {
  createLoader,
  parseAsArrayOf,
  parseAsIsoDate,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import { tableParsers } from "@/components/data-table";

/** Local copy of the alert keys — see `alert-meta.ts` on why this isn't imported. */
export const ALERT_TYPE_VALUES = [
  "staff-role-changed",
  "staff-disabled",
  "impersonation-started",
  "invite-accepted",
  "customer-banned",
  "points-adjusted",
  "stamps-adjusted",
  "purchase-voided",
  "campaign-finished",
  "campaign-failures",
  "customer-signup",
  "daily-digest",
] as const;

export const SEVERITY_VALUES = [
  "info",
  "success",
  "warning",
  "critical",
] as const;

const TABS = ["inbox", "archive"] as const;
const READ_STATES = ["read", "unread"] as const;

/** Full nuqs parser map for the alerts list URL (table state + facets). */
export const alertsSearchParams = {
  q: tableParsers.q,
  page: tableParsers.page,
  perPage: tableParsers.perPage,
  sort: tableParsers.sort,
  view: tableParsers.view,
  cols: tableParsers.cols,
  tab: parseAsStringLiteral(TABS).withDefault("inbox"),
  type: parseAsArrayOf(parseAsString).withDefault([]),
  severity: parseAsArrayOf(parseAsString).withDefault([]),
  read: parseAsStringLiteral(READ_STATES),
  from: parseAsIsoDate,
  to: parseAsIsoDate,
};

export type AlertsSearchValues = {
  q: string;
  page: number;
  perPage: number;
  sort: { id: string; desc: boolean }[];
  tab: (typeof TABS)[number];
  type: string[];
  severity: string[];
  read: (typeof READ_STATES)[number] | null;
  from: Date | null;
  to: Date | null;
  /** Store scope from the switcher, not the URL query. */
  storeId?: string | undefined;
};

/**
 * Derive the server input from the parsed URL values. A facet that selects
 * everything is dropped (it narrows nothing), and `to` is taken to end-of-day
 * so the range reads inclusively.
 */
export function buildAlertsInput(v: AlertsSearchValues): AdminAlertsListInput {
  return {
    q: v.q || undefined,
    page: v.page,
    perPage: v.perPage,
    sort: v.sort,
    tab: v.tab,
    storeId: v.storeId,
    type:
      v.type.length > 0 && v.type.length < ALERT_TYPE_VALUES.length
        ? (v.type as AdminAlertsListInput["type"])
        : undefined,
    severity:
      v.severity.length > 0 && v.severity.length < SEVERITY_VALUES.length
        ? (v.severity as AdminAlertsListInput["severity"])
        : undefined,
    read: v.read ?? undefined,
    createdFrom: v.from ?? undefined,
    createdTo: v.to ? endOfDay(v.to) : undefined,
  };
}

/** RSC: parse the request searchParams into the typed values. */
export const loadAlertsSearchParams = createLoader(alertsSearchParams);
