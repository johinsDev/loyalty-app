import type { RewardRow } from "@loyalty/db/schema";

import { isAffordable, type Balances } from "./repository";
import type {
  CurrencyProgress,
  RewardCurrency,
  RewardListItem,
  RewardStatus,
} from "./schemas";

function currencyProgress(
  required: number | null,
  balance: number,
): CurrencyProgress {
  if (required == null) {
    return { required: null, balance, progress: 1, affordable: false };
  }
  const progress = required <= 0 ? 1 : Math.min(1, Math.max(0, balance / required));
  return { required, balance, progress, affordable: balance >= required };
}

/** Currencies the customer can pay this reward with right now (honors costMode:
 *  "and" requires BOTH affordable to count either). */
export function affordableWith(
  rw: Pick<RewardRow, "stampsRequired" | "pointsCost" | "costMode">,
  balances: Balances,
): RewardCurrency[] {
  const stampsOk =
    rw.stampsRequired != null && balances.stamps >= rw.stampsRequired;
  const pointsOk = rw.pointsCost != null && balances.points >= rw.pointsCost;
  if (rw.stampsRequired != null && rw.pointsCost != null && rw.costMode === "and") {
    return stampsOk && pointsOk ? ["stamps", "points"] : [];
  }
  const out: RewardCurrency[] = [];
  if (stampsOk) out.push("stamps");
  if (pointsOk) out.push("points");
  return out;
}

/**
 * Derive the customer-facing status + progress for one reward. Pure (no DB) so
 * it's unit-testable in isolation. Status precedence:
 *   redeemed (once & claimed) → locked (tier) → ready (affordable) → upcoming.
 */
export function deriveItem(
  rw: RewardRow,
  ctx: {
    balances: Balances;
    tierKey: string;
    claimedCount: number;
    redeemedAt: Date | null;
  },
): RewardListItem {
  const locked =
    rw.allowedTiers != null && !rw.allowedTiers.includes(ctx.tierKey);
  const redeemedOnce =
    rw.limitPerCustomer === "once" && ctx.claimedCount > 0;

  let status: RewardStatus;
  if (redeemedOnce) status = "redeemed";
  else if (locked) status = "locked";
  else if (isAffordable(rw, ctx.balances)) status = "ready";
  else status = "upcoming";

  return {
    id: rw.id,
    name: rw.name,
    description: rw.description,
    imageUrl: rw.imageUrl,
    backgroundCss: rw.backgroundCss,
    icon: rw.icon,
    type: rw.type,
    stampsRequired: rw.stampsRequired,
    pointsCost: rw.pointsCost,
    costMode: rw.costMode as "or" | "and",
    allowedTiers: rw.allowedTiers,
    storeIds: rw.storeIds,
    sections: rw.sections,
    sortOrder: rw.sortOrder,
    limitPerCustomer: rw.limitPerCustomer as "unlimited" | "once",
    status,
    stamps: currencyProgress(rw.stampsRequired, ctx.balances.stamps),
    points: currencyProgress(rw.pointsCost, ctx.balances.points),
    affordableWith: status === "ready" ? affordableWith(rw, ctx.balances) : [],
    redeemedAt: redeemedOnce ? ctx.redeemedAt : null,
  };
}
