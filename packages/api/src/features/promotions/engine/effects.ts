import type { PromoRule } from "@loyalty/db/schema";

import { excludedAmountCents, type UnitExclusion } from "./exclusions";
import type { Cart, CartUnit, MatchResult, RuleApplication } from "./types";
import { subtotalCents } from "./types";

export interface EffectResult {
  discountCents: number;
  pointsMultiplier: number;
}

const NONE: EffectResult = { discountCents: 0, pointsMultiplier: 1 };

const sum = (units: CartUnit[]) => units.reduce((s, u) => s + u.amountCents, 0);

const cheapest = (units: CartUnit[], count: number): CartUnit[] =>
  [...units].sort((a, b) => a.amountCents - b.amountCents).slice(0, count);

const targetUnits = (app: RuleApplication, target: "buy" | "get" | "order"): CartUnit[] =>
  target === "get" ? app.getUnits : app.buyUnits;

/** Compute the monetary effect of a matched rule. Assumes `match` has at least
 *  one application (evaluate gates on that). */
export function computeEffect(
  cart: Cart,
  rule: PromoRule,
  match: MatchResult,
  exclusions: UnitExclusion[] = [],
): EffectResult {
  const e = rule.effect;
  const orderSubtotal = Math.max(
    0,
    subtotalCents(cart.lines) - excludedAmountCents(cart, exclusions),
  );

  switch (e.kind) {
    case "percentOff": {
      if (e.target === "order") {
        let d = Math.round((orderSubtotal * e.percent) / 100);
        if (e.maxDiscountCents != null) d = Math.min(d, e.maxDiscountCents);
        return { discountCents: Math.max(0, d), pointsMultiplier: 1 };
      }
      let total = 0;
      for (const app of match.applications) {
        let units = targetUnits(app, e.target);
        if (e.select) units = cheapest(units, e.select.count);
        total += Math.round((sum(units) * e.percent) / 100);
      }
      if (e.maxDiscountCents != null) total = Math.min(total, e.maxDiscountCents);
      return { discountCents: Math.max(0, total), pointsMultiplier: 1 };
    }
    case "amountOff": {
      if (e.target === "order")
        return { discountCents: Math.min(e.amountCents, orderSubtotal), pointsMultiplier: 1 };
      let total = 0;
      for (const app of match.applications)
        total += Math.min(e.amountCents, sum(targetUnits(app, e.target)));
      return { discountCents: total, pointsMultiplier: 1 };
    }
    case "fixedPrice": {
      let total = 0;
      for (const app of match.applications)
        total += Math.max(0, sum(app.buyUnits) - e.priceCents);
      return { discountCents: total, pointsMultiplier: 1 };
    }
    case "freeUnits": {
      let total = 0;
      for (const app of match.applications)
        total += sum(cheapest(targetUnits(app, e.target), e.count));
      return { discountCents: total, pointsMultiplier: 1 };
    }
    case "tieredPercent": {
      // Single-pass over ALL matched units: the tier is picked by total
      // matched quantity, not per application.
      const units = match.applications.flatMap((app) => app.buyUnits);
      const tier = [...e.tiers]
        .sort((a, b) => b.minQty - a.minQty)
        .find((t) => units.length >= t.minQty);
      if (!tier) return NONE;
      return {
        discountCents: Math.max(0, Math.round((sum(units) * tier.percent) / 100)),
        pointsMultiplier: 1,
      };
    }
    case "pointsMultiplier":
      return { discountCents: 0, pointsMultiplier: e.multiplier };
    default:
      return NONE;
  }
}
