import { computeEffect } from "./effects";
import { ineligibleReason } from "./eligibility";
import { matchRule } from "./match";
import type { Cart, CustomerFacts, IneligibleReason, PromoEvaluation, PromoView } from "./types";
import { subtotalCents } from "./types";

const failed = (reason: IneligibleReason): PromoEvaluation => ({
  eligible: false,
  reason,
  discountCents: 0,
  pointsMultiplier: 1,
  applications: 0,
  missingGetSide: [],
});

/** Full evaluation of one promo against one cart + customer. */
export function evaluatePromo(
  cart: Cart,
  view: PromoView,
  facts: CustomerFacts,
  now: Date,
): PromoEvaluation {
  const pre = ineligibleReason(view, facts, now);
  if (pre) return failed(pre);
  if (!view.rule) return failed("no-matching-items");

  const sub = subtotalCents(cart.lines);
  const c = view.conditions ?? {};
  if (c.minPurchaseCents != null && sub < c.minPurchaseCents) return failed("below-min-purchase");
  if (view.rule.buy.minSubtotalCents != null && sub < view.rule.buy.minSubtotalCents)
    return failed("below-threshold");

  const match = matchRule(cart, view.rule);
  if (match.applications.length === 0) {
    if (match.missingGetSide.length > 0)
      return { ...failed("missing-get-side"), missingGetSide: match.missingGetSide };
    return failed("no-matching-items");
  }

  const effect = computeEffect(cart, view.rule, match);
  return {
    eligible: true,
    reason: null,
    // Modifier deltas are inside unitAmountCents AND expand into their own
    // units, so clamp to the order subtotal as a final guard.
    discountCents: Math.min(effect.discountCents, sub),
    pointsMultiplier: effect.pointsMultiplier,
    applications: match.applications.length,
    missingGetSide: [],
  };
}

/** Best promo = highest discount, then highest multiplier, then lowest sortOrder. */
export function pickBest<T extends { evaluation: PromoEvaluation; sortOrder: number }>(
  items: T[],
): T | null {
  let best: T | null = null;
  for (const item of items) {
    if (!item.evaluation.eligible) continue;
    if (
      !best ||
      item.evaluation.discountCents > best.evaluation.discountCents ||
      (item.evaluation.discountCents === best.evaluation.discountCents &&
        (item.evaluation.pointsMultiplier > best.evaluation.pointsMultiplier ||
          (item.evaluation.pointsMultiplier === best.evaluation.pointsMultiplier &&
            item.sortOrder < best.sortOrder)))
    )
      best = item;
  }
  return best;
}
