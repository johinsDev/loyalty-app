import type { Cart, CartLine, UnitExclusion } from "../promotions/engine";

/** The one unit a `variantUpgrade` reward moves up, decided against a cart. */
export interface UpgradePlan {
  lineIndex: number;
  toVariantId: string;
  deltaCents: number;
}

export interface AppliedUpgrade {
  cart: Cart;
  /** Where the upgraded unit ended up — its own line, post-split. */
  upgradedIndex: number;
  exclusions: UnitExclusion[];
}

/**
 * Pick the unit to upgrade: exactly one, the biggest step up.
 *
 * The old evaluator took `Math.min` of the eligible deltas, so a customer with a
 * cheap and an expensive drink got the cheap upgrade — nobody asked for that and
 * it reads as stingy. Ties break on the lowest line index so the choice is
 * deterministic across preview and the recorded sale.
 */
export function pickUpgrade(cart: Cart): UpgradePlan | null {
  let best: UpgradePlan | null = null;
  cart.lines.forEach((line, lineIndex) => {
    const target = line.upgradeTo;
    if (!target || target.deltaCents <= 0) return;
    if (!best || target.deltaCents > best.deltaCents) {
      best = { lineIndex, toVariantId: target.variantId, deltaCents: target.deltaCents };
    }
  });
  return best;
}

/**
 * Move one unit of `plan.lineIndex` up to the target variant.
 *
 * The new unit price is the line's ACTUAL `unitAmountCents` plus the base-price
 * step — not a recomputation from the catalog price. Modifier and add-on deltas
 * ride inside `unitAmountCents`, so adding the difference carries them across
 * untouched; recomputing would silently drop the customer's toppings from the
 * price. (`detectPromoUpsell` reaches the same result the long way round, by
 * subtracting the base price out and adding it back.)
 *
 * A line of qty > 1 is split so the ticket states what the customer receives:
 * two Medianos and one Grande, not "three Medianos" with money taken off.
 */
export function applyUpgrade(cart: Cart, plan: UpgradePlan): AppliedUpgrade {
  const line = cart.lines[plan.lineIndex]!;
  const upgraded: CartLine = {
    ...line,
    qty: 1,
    variantId: plan.toVariantId,
    unitAmountCents: line.unitAmountCents + plan.deltaCents,
    // The upgrade is spent; this line must never be picked again.
    upgradeTo: null,
  };

  let lines: CartLine[];
  let upgradedIndex: number;
  if (line.qty === 1) {
    lines = cart.lines.map((l, i) => (i === plan.lineIndex ? upgraded : l));
    upgradedIndex = plan.lineIndex;
  } else {
    // Inserted right after its origin so the ticket reads in cart order.
    lines = [
      ...cart.lines.slice(0, plan.lineIndex),
      { ...line, qty: line.qty - 1 },
      upgraded,
      ...cart.lines.slice(plan.lineIndex + 1),
    ];
    upgradedIndex = plan.lineIndex + 1;
  }

  return {
    cart: { ...cart, lines },
    upgradedIndex,
    // One product unit, withheld from the promo remainder — the upgraded drink
    // gets the reward, the rest of the cart stays eligible for promos.
    exclusions: [{ lineIndex: upgradedIndex, source: "product", count: 1 }],
  };
}
