import type { CustomersListInput } from "@loyalty/api/features/customers/schemas";
import { endOfDay } from "@loyalty/date";

export const TIER_VALUES = ["hoja", "flor", "oro"] as const;
export const STATUS_VALUES = ["active", "banned", "inactive"] as const;

export type CustomersSearchValues = {
  q: string;
  page: number;
  perPage: number;
  sort: { id: string; desc: boolean }[];
  tier: string[];
  status: string[];
  from: Date | null;
  to: Date | null;
  spendMin: number | null;
  spendMax: number | null;
};

function facet<T extends string>(values: string[], all: readonly T[]): T[] | undefined {
  const picked = values.filter((v): v is T => (all as readonly string[]).includes(v));
  return picked.length > 0 && picked.length < all.length ? picked : undefined;
}

export function buildCustomersInput(v: CustomersSearchValues): CustomersListInput {
  return {
    q: v.q || undefined,
    page: v.page,
    perPage: v.perPage,
    sort: v.sort,
    tiers: facet(v.tier, TIER_VALUES),
    status: facet(v.status, STATUS_VALUES),
    joinedFrom: v.from ?? undefined,
    joinedTo: v.to ? endOfDay(v.to) : undefined,
    spendMin: v.spendMin ?? undefined,
    spendMax: v.spendMax ?? undefined,
  };
}
