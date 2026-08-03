import type { PromoRule } from "@loyalty/db/schema";

import { excludedAmountCents, type UnitExclusion } from "./exclusions";
import type { Cart, CartUnit, MatchResult, RuleApplication } from "./types";
import { subtotalCents } from "./types";

export interface EffectResult {
  discountCents: number;
  pointsMultiplier: number;
  /**
   * The units the discount actually landed on, when the effect picks a SUBSET
   * of what it matched — a 3x2 frees one drink of the three, a second-unit
   * halves one of the pair.
   *
   * `computeEffect` was choosing them and throwing them away, so the register
   * could only mark every participating line and never say which drink was the
   * free one. Empty when the effect covers everything it matched (a plain
   * category percentage) — then there is nothing to single out.
   */
  discountedUnits: CartUnit[];
}

const NONE: EffectResult = { discountCents: 0, pointsMultiplier: 1, discountedUnits: [] };

/**
 * What a scoped effect may take off.
 *
 * `discountAddons` on the rule decides whether a line's toppings are part of
 * the offer. Off by default, because including them is what happens by accident
 * — the line's price arrives with the add-ons already folded in.
 */
const sum = (units: CartUnit[], withAddons = false) =>
  units.reduce((s, u) => s + (withAddons ? u.amountCents : u.discountableCents), 0);

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
  // Whether this promo's offer covers the add-ons on a line.
  const withAddons = rule.discountAddons === true;
  const orderSubtotal = Math.max(
    0,
    subtotalCents(cart.lines) - excludedAmountCents(cart, exclusions),
  );

  switch (e.kind) {
    case "percentOff": {
      if (e.target === "order") {
        let d = Math.round((orderSubtotal * e.percent) / 100);
        if (e.maxDiscountCents != null) d = Math.min(d, e.maxDiscountCents);
        return { discountCents: Math.max(0, d), pointsMultiplier: 1, discountedUnits: [] };
      }
      let total = 0;
      const picked: CartUnit[] = [];
      for (const app of match.applications) {
        let units = targetUnits(app, e.target);
        if (e.select) {
          units = cheapest(units, e.select.count);
          picked.push(...units);
        }
        total += Math.round((sum(units, withAddons) * e.percent) / 100);
      }
      if (e.maxDiscountCents != null) total = Math.min(total, e.maxDiscountCents);
      return { discountCents: Math.max(0, total), pointsMultiplier: 1, discountedUnits: picked };
    }
    case "amountOff": {
      if (e.target === "order")
        return { discountCents: Math.min(e.amountCents, orderSubtotal), pointsMultiplier: 1, discountedUnits: [] };
      let total = 0;
      for (const app of match.applications)
        total += Math.min(e.amountCents, sum(targetUnits(app, e.target), withAddons));
      return { discountCents: total, pointsMultiplier: 1, discountedUnits: [] };
    }
    case "fixedPrice": {
      let total = 0;
      for (const app of match.applications)
        total += Math.max(0, sum(app.buyUnits, withAddons) - e.priceCents);
      return { discountCents: total, pointsMultiplier: 1, discountedUnits: [] };
    }
    case "freeUnits": {
      let total = 0;
      const freed: CartUnit[] = [];
      for (const app of match.applications) {
        const units = cheapest(targetUnits(app, e.target), e.count);
        freed.push(...units);
        total += sum(units, withAddons);
      }
      return { discountCents: total, pointsMultiplier: 1, discountedUnits: freed };
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
        discountCents: Math.max(0, Math.round((sum(units, withAddons) * tier.percent) / 100)),
        pointsMultiplier: 1,
        discountedUnits: [],
      };
    }
    case "pointsMultiplier":
      return { discountCents: 0, pointsMultiplier: e.multiplier, discountedUnits: [] };
    default:
      return NONE;
  }
}
