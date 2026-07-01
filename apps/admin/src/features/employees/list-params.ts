import type { EmployeesListInput } from "@loyalty/api/features/employees/schemas";
import { createLoader, parseAsArrayOf, parseAsString } from "nuqs/server";

import { tableParsers } from "@/components/data-table";

const ROLE_VALUES = ["owner", "manager", "staff"] as const;
const STATUS_VALUES = ["active", "invited", "disabled"] as const;

/** Full nuqs parser map for the employees list URL (table state + facets),
 *  shared by the client view and the RSC loader. */
export const employeesSearchParams = {
  q: tableParsers.q,
  page: tableParsers.page,
  perPage: tableParsers.perPage,
  sort: tableParsers.sort,
  view: tableParsers.view,
  cols: tableParsers.cols,
  role: parseAsArrayOf(parseAsString).withDefault([]),
  status: parseAsArrayOf(parseAsString).withDefault([]),
  storeId: parseAsArrayOf(parseAsString).withDefault([]),
};

export type EmployeesSearchValues = {
  q: string;
  page: number;
  perPage: number;
  sort: { id: string; desc: boolean }[];
  role: string[];
  status: string[];
  storeId: string[];
};

/** Derive the server list input from the parsed URL values (a facet with every
 *  value checked collapses to "no filter"). */
export function buildEmployeesInput(v: EmployeesSearchValues): EmployeesListInput {
  return {
    q: v.q || undefined,
    page: v.page,
    perPage: v.perPage,
    sort: v.sort,
    role:
      v.role.length > 0 && v.role.length < ROLE_VALUES.length
        ? (v.role as ("owner" | "manager" | "staff")[])
        : undefined,
    status:
      v.status.length > 0 && v.status.length < STATUS_VALUES.length
        ? (v.status as ("active" | "invited" | "disabled")[])
        : undefined,
    storeId: v.storeId.length > 0 ? v.storeId : undefined,
  };
}

export const loadEmployeesSearchParams = createLoader(employeesSearchParams);
