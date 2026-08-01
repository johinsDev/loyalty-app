import type { PromoItemRef, RewardBenefitConfig } from "@loyalty/db/schema";

import { unitsMatching } from "../promotions/engine";
import type { Cart, UnitExclusion } from "../promotions/engine";
import type { PromoRepository } from "../promotions";
import { evaluateRewardForCart } from "./pos-evaluate";
import { applyUpgrade } from "./variant-swap";

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
  /** The cart to price. Identical to the input unless the benefit changed it —
   *  `variantUpgrade` moves one unit up and splits its line. */
  cart: Cart;
  discountCents: number;
  /** Units the reward consumed, withheld from the promo remainder. */
  exclusions: UnitExclusion[];
  /** Set when the cart was changed, so callers can mirror the split onto the
   *  raw purchase lines and the register can explain what happened. */
  upgrade: AppliedUpgradeInfo | null;
  /** Presentation-only line the benefit landed on when it consumed no unit (a
   *  free add-on waives a price without excluding anything). */
  target?: { lineIndex: number; label?: string } | null;
  ok: boolean;
  reason: string | null;
}

export interface AppliedUpgradeInfo {
  /** Index in the ORIGINAL cart — the line the cashier is looking at. */
  sourceLineIndex: number;
  /** Index in the returned cart, where the upgraded unit lives. */
  upgradedIndex: number;
  toVariantId: string;
  deltaCents: number;
  /** Units left behind on the original line (qty − 1). */
  remainingQty: number;
  upgradedUnitAmountCents: number;
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
  const targets = await repo.variantUpgradeTargets(
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
      upgradeTo: l.variantId && inScope.has(i) ? (targets.get(l.variantId) ?? null) : null,
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
    return {
      cart,
      discountCents: 0,
      exclusions: [],
      upgrade: null,
      ok: false,
      reason: res.reason,
    };
  }

  if (res.upgrade) {
    const source = cart.lines[res.upgrade.lineIndex]!;
    const applied = applyUpgrade(cart, res.upgrade);
    return {
      cart: applied.cart,
      discountCents: res.discountCents,
      exclusions: applied.exclusions,
      upgrade: {
        sourceLineIndex: res.upgrade.lineIndex,
        upgradedIndex: applied.upgradedIndex,
        toVariantId: res.upgrade.toVariantId,
        deltaCents: res.upgrade.deltaCents,
        remainingQty: source.qty - 1,
        upgradedUnitAmountCents: source.unitAmountCents + res.upgrade.deltaCents,
      },
      ok: true,
      reason: null,
    };
  }

  return {
    cart,
    discountCents: res.discountCents,
    exclusions: res.exclusions,
    upgrade: null,
    // Passed through for benefits that discount a line without consuming a
    // unit, so the register can still mark which line it landed on.
    target: res.target ?? null,
    ok: true,
    reason: null,
  };
}
