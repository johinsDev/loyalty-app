import type { PromoItemRef } from "@loyalty/db/schema";

import { evaluatePromo } from "./evaluate";
import { excludedAmountCents, type UnitExclusion } from "./exclusions";
import type { Cart, CustomerFacts, PromoView } from "./types";
import { subtotalCents } from "./types";

/**
 * Register upsell engine (pure). Given ONE promo that does NOT currently apply
 * to the cart, decide whether a single cashier-actionable nudge would unlock
 * it, and which:
 *
 *  - **add-item** — the buy-side is satisfiable but a get-side ref is missing
 *    ("add a large tea to get the 2nd 50% off"). Reuses `missingGetSide`.
 *  - **spend-to-threshold** — the promo needs a minimum subtotal the cart is
 *    under ("spend $3.000 more to unlock 15% off").
 *  - **variant-swap** — a cart line's sibling variant (same product, other
 *    variant) would satisfy the buy-side ("switch to Grande (+$2.000) → the 3x2
 *    applies"). Re-evaluates the promo against the hypothetical swapped cart.
 *
 * Only ONE reason is returned per promo (the one matching the ineligibility),
 * so the ticket shows at most one nudge per promo. Customer/time ineligibility
 * (wrong tier, outside window, …) is never upsellable → `null`.
 *
 * Pure: it reuses `evaluatePromo` for the what-if re-evaluation, so a swap can
 * never claim a discount the real checkout wouldn't also grant.
 */

/** Every variant of a product in the cart, with its base unit price. Lets the
 *  engine price a hypothetical swap. */
export interface VariantOption {
  variantId: string;
  priceCents: number;
}
export type VariantCatalog = Record<string, VariantOption[]>;

export type PromoUpsell =
  | { kind: "add-item"; missingGetSide: PromoItemRef[] }
  | { kind: "spend-to-threshold"; addCents: number }
  | {
      kind: "variant-swap";
      lineIndex: number;
      fromVariantId: string;
      toVariantId: string;
      /** Extra the customer pays for the whole line after swapping. */
      extraCents: number;
      /** The discount the promo grants once swapped. */
      discountCents: number;
    };

/** Reward-excluded subtotal — matches `evaluatePromo`'s threshold basis. */
function netSubtotal(cart: Cart, exclusions: UnitExclusion[]): number {
  return Math.max(0, subtotalCents(cart.lines) - excludedAmountCents(cart, exclusions));
}

export function detectPromoUpsell(
  cart: Cart,
  view: PromoView,
  facts: CustomerFacts,
  now: Date,
  exclusions: UnitExclusion[],
  variants: VariantCatalog,
): PromoUpsell | null {
  const ev = evaluatePromo(cart, view, facts, now, exclusions);
  if (ev.eligible) return null; // already applies — no nudge

  switch (ev.reason) {
    case "missing-get-side":
      return ev.missingGetSide.length > 0
        ? { kind: "add-item", missingGetSide: ev.missingGetSide }
        : null;

    case "below-min-purchase": {
      const target = view.conditions?.minPurchaseCents ?? 0;
      const addCents = target - netSubtotal(cart, exclusions);
      return addCents > 0 ? { kind: "spend-to-threshold", addCents } : null;
    }

    case "below-threshold": {
      const target = view.rule?.buy.minSubtotalCents ?? 0;
      const addCents = target - netSubtotal(cart, exclusions);
      return addCents > 0 ? { kind: "spend-to-threshold", addCents } : null;
    }

    case "no-matching-items":
      // The buy-side isn't satisfiable as-is — an upsized variant might do it.
      return detectVariantSwap(cart, view, facts, now, exclusions, variants);

    default:
      return null;
  }
}

/**
 * Find the single best variant swap that turns this promo eligible: for each
 * cart line with a pricier sibling variant, re-evaluate the promo against the
 * cart with that line swapped. Only honest wins are returned — the promo must
 * become eligible with a discount, and that discount must cover the extra the
 * customer pays. Best = highest net benefit (discount − extra), then cheapest
 * upgrade.
 */
function detectVariantSwap(
  cart: Cart,
  view: PromoView,
  facts: CustomerFacts,
  now: Date,
  exclusions: UnitExclusion[],
  variants: VariantCatalog,
): PromoUpsell | null {
  let best: (PromoUpsell & { kind: "variant-swap" }) | null = null;
  let bestNet = 0;

  cart.lines.forEach((line, lineIndex) => {
    if (!line.variantId) return;
    const siblings = variants[line.productId];
    if (!siblings || siblings.length < 2) return;
    const current = siblings.find((v) => v.variantId === line.variantId);
    if (!current) return;
    // Modifier deltas ride inside unitAmountCents; preserve them across the swap.
    const modifierDelta = line.unitAmountCents - current.priceCents;

    for (const sib of siblings) {
      if (sib.variantId === line.variantId) continue;
      const newUnit = sib.priceCents + modifierDelta;
      const extraCents = (newUnit - line.unitAmountCents) * line.qty;
      if (extraCents <= 0) continue; // only upsell to a pricier variant

      const swapped: Cart = {
        ...cart,
        lines: cart.lines.map((l, i) =>
          i === lineIndex ? { ...l, variantId: sib.variantId, unitAmountCents: newUnit } : l,
        ),
      };
      const ev = evaluatePromo(swapped, view, facts, now, exclusions);
      if (!ev.eligible || ev.discountCents <= 0) continue;

      const net = ev.discountCents - extraCents;
      if (net <= 0) continue; // not a credible win — the discount must beat the upgrade
      if (net > bestNet || (net === bestNet && (best === null || extraCents < best.extraCents))) {
        best = {
          kind: "variant-swap",
          lineIndex,
          fromVariantId: line.variantId,
          toVariantId: sib.variantId,
          extraCents,
          discountCents: ev.discountCents,
        };
        bestNet = net;
      }
    }
  });

  return best;
}
