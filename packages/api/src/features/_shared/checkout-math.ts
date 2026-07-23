/**
 * Register checkout money engine (pure). Combines the three discount layers a
 * sale can carry — a redeemed **reward**, one **promo**, and the customer's
 * **tier** benefit % — into a final net, honoring the org's stacking policy and
 * a max-total-discount cap.
 *
 * This is money: it's server-authoritative (the client never computes the
 * charge) and pure (unit-tested exhaustively). `recordPurchase` and `preview`
 * both call it so the previewed total always equals the charged total.
 *
 * Layer rules (decided with the founder):
 *  - Never two promos (enforced upstream: a single `appliedPromoId`).
 *  - Application order: reward → promo → tier%, each on the running remainder.
 *  - An **exclusive** promo suppresses reward + tier (only the promo applies).
 *  - `rewardStacksWithPromo=false` drops the promo when a reward is present
 *    (the reward is the customer's explicit redemption → it wins).
 *  - `tierStacksWithPromo=false` drops the tier% when a promo is applied.
 *  - The total discount is capped at `maxTotalDiscountPct` of the subtotal; the
 *    cap eats the tier first, then the promo, then the reward — so the layers
 *    with a ledger record (reward redemption, promo redemption) survive intact.
 */

export interface StackingPolicy {
  tierStacksWithPromo: boolean;
  rewardStacksWithPromo: boolean;
  /** 0–100. `100` = no cap. */
  maxTotalDiscountPct: number;
}

export interface NetInput {
  subtotalCents: number;
  /** Precomputed by `evaluateRewardForCart` (0 if no reward). */
  rewardDiscountCents: number;
  /** Precomputed by `PromoService.applicable` (0 if no promo). */
  promoDiscountCents: number;
  /** The applied promo's `exclusive` flag. */
  promoExclusive: boolean;
  /** The customer's tier discount, 0–100 (0 if none). */
  tierDiscountPct: number;
}

export interface NetResult {
  netPriceCents: number;
  /** The discount each layer actually contributed (post-gating, post-cap). */
  rewardDiscountCents: number;
  promoDiscountCents: number;
  tierDiscountCents: number;
  totalDiscountCents: number;
  capApplied: boolean;
  /** Which requested layers were dropped by the stacking policy. */
  suppressed: { reward: boolean; promo: boolean; tier: boolean };
}

export function resolveNet(input: NetInput, policy: StackingPolicy): NetResult {
  const sub = Math.max(0, Math.round(input.subtotalCents));
  const wantReward = input.rewardDiscountCents > 0;
  const wantPromo = input.promoDiscountCents > 0;
  const wantTier = input.tierDiscountPct > 0;

  // 1. Decide which layers apply (policy + exclusivity gating).
  let reward = wantReward;
  let promo = wantPromo;
  let tier = wantTier;

  if (promo && input.promoExclusive) {
    reward = false;
    tier = false;
  } else {
    if (reward && promo && !policy.rewardStacksWithPromo) promo = false;
    if (promo && tier && !policy.tierStacksWithPromo) tier = false;
  }

  // 2. Apply in order on the running remainder.
  let remainder = sub;
  let rewardDisc = reward ? Math.min(input.rewardDiscountCents, remainder) : 0;
  remainder -= rewardDisc;
  let promoDisc = promo ? Math.min(input.promoDiscountCents, remainder) : 0;
  remainder -= promoDisc;
  let tierDisc = tier ? Math.floor((remainder * input.tierDiscountPct) / 100) : 0;
  remainder -= tierDisc;

  // 3. Cap the total discount, eating tier → promo → reward.
  let total = rewardDisc + promoDisc + tierDisc;
  const cap = Math.floor((sub * clampPct(policy.maxTotalDiscountPct)) / 100);
  let capApplied = false;
  if (total > cap) {
    capApplied = true;
    let excess = total - cap;
    const cut = (v: number) => {
      const c = Math.min(v, excess);
      excess -= c;
      return v - c;
    };
    tierDisc = cut(tierDisc);
    promoDisc = cut(promoDisc);
    rewardDisc = cut(rewardDisc);
    total = rewardDisc + promoDisc + tierDisc;
  }

  return {
    netPriceCents: Math.max(0, sub - total),
    rewardDiscountCents: rewardDisc,
    promoDiscountCents: promoDisc,
    tierDiscountCents: tierDisc,
    totalDiscountCents: total,
    capApplied,
    suppressed: {
      reward: wantReward && !reward,
      promo: wantPromo && !promo,
      tier: wantTier && !tier,
    },
  };
}

function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return 100;
  return Math.min(100, Math.max(0, pct));
}
