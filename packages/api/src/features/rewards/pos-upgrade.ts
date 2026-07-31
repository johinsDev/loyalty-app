import type { PromoItemRef, RewardBenefitConfig } from "@loyalty/db/schema";

import { unitsMatching } from "../promotions/engine";
import type { Cart, UnitExclusion } from "../promotions/engine";
import type { PromoRepository } from "../promotions";
import { evaluateRewardForCart } from "./pos-evaluate";

/**
 * A reward resolved against a cart: the cart the rest of the checkout should
 * price, plus what the reward takes off it.
 *
 * This exists because `variantUpgrade` needs the variant graph, so it can't be
 * evaluated by the pure evaluator alone — and the "stitch, then evaluate" pair
 * was written out three times in the stamps router (preview's inline reward,
 * preview's per-reward eligibility loop, and recordPurchase). Three copies of
 * the checkout's most subtle step is how preview and the recorded sale drift
 * apart. One function, three callers.
 */
export interface RewardOnCart {
  /** The cart to price. Identical to the input unless the benefit changed it. */
  cart: Cart;
  discountCents: number;
  /** Units the reward consumed, withheld from the promo remainder. */
  exclusions: UnitExclusion[];
  ok: boolean;
  reason: string | null;
}

/** Cart lines a reward's `refs` cover. `[]` refs = the whole menu.
 *
 *  Uses the engine's matcher rather than the hand-rolled one this replaces,
 *  which had already drifted — it never handled `modifierOption` refs. */
function linesInScope(cart: Cart, refs: PromoItemRef[]): Set<number> {
  return new Set(unitsMatching(cart, refs).map((u) => u.lineIndex));
}

/**
 * Attach `upgradeDeltaCents` to every in-scope line. Reward-specific (it needs
 * the variant graph), so it only runs for `variantUpgrade` — the common path
 * pays nothing.
 */
async function stitchUpgradeDeltas(
  repo: PromoRepository,
  cart: Cart,
  benefit: Extract<RewardBenefitConfig, { type: "variantUpgrade" }>,
): Promise<Cart> {
  const variantIds = [
    ...new Set(cart.lines.map((l) => l.variantId).filter((v): v is string => v != null)),
  ];
  const deltas = await repo.variantUpgradeDeltas(
    variantIds,
    benefit.optionName,
    benefit.fromValueLabel,
    benefit.toValueLabel,
  );
  const inScope = linesInScope(cart, benefit.refs);
  return {
    ...cart,
    lines: cart.lines.map((l, i) => ({
      ...l,
      upgradeDeltaCents:
        l.variantId && inScope.has(i) ? (deltas.get(l.variantId) ?? null) : null,
    })),
  };
}

/** Resolve a reward against an already-enriched cart. */
export async function resolveRewardOnCart(
  repo: PromoRepository,
  reward: { benefit: RewardBenefitConfig | null },
  enriched: Cart,
): Promise<RewardOnCart> {
  const cart =
    reward.benefit?.type === "variantUpgrade"
      ? await stitchUpgradeDeltas(repo, enriched, reward.benefit)
      : enriched;

  const res = evaluateRewardForCart(reward, cart);
  if (!res.ok) {
    return { cart, discountCents: 0, exclusions: [], ok: false, reason: res.reason };
  }
  return {
    cart,
    discountCents: res.discountCents,
    exclusions: res.exclusions,
    ok: true,
    reason: null,
  };
}
