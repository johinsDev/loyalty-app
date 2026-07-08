import type { PromoRule, RewardBenefitConfig } from "@loyalty/db/schema";

/**
 * Compile a reward's typed benefit into the generic promo rule the engine
 * evaluates. Rewards are claimed explicitly, so every rule applies exactly once
 * (`maxApplicationsPerOrder: 1`) with an empty buy trigger. `experience` has no
 * monetary effect and returns null.
 *
 * `freeProduct` uses the same shape as a promo crossSell (get side free), but
 * the reward evaluator re-binds the freed unit to the CHEAPEST match afterwards
 * (paid-with-points reward → business wants cheapest-free), which promo
 * crossSell does not.
 */
export function compileRewardRule(config: RewardBenefitConfig): PromoRule | null {
  switch (config.type) {
    case "freeProduct":
      return {
        buy: { requirements: [] },
        get: { requirements: [{ refs: config.refs, qty: 1 }] },
        effect: { kind: "percentOff", percent: 100, target: "get" },
        maxApplicationsPerOrder: 1,
      };
    case "amountOff":
      return config.refs.length > 0
        ? {
            buy: { requirements: [{ refs: config.refs, qty: 1 }] },
            effect: { kind: "amountOff", amountCents: config.amountCents, target: "buy" },
            maxApplicationsPerOrder: 1,
          }
        : {
            buy: { requirements: [] },
            effect: { kind: "amountOff", amountCents: config.amountCents, target: "order" },
            maxApplicationsPerOrder: 1,
          };
    case "percentOff": {
      const cap =
        config.maxDiscountCents != null ? { maxDiscountCents: config.maxDiscountCents } : {};
      return config.refs.length > 0
        ? {
            buy: { requirements: [{ refs: config.refs, qty: 1 }] },
            effect: { kind: "percentOff", percent: config.percent, target: "buy", ...cap },
            maxApplicationsPerOrder: 1,
          }
        : {
            buy: { requirements: [] },
            effect: { kind: "percentOff", percent: config.percent, target: "order", ...cap },
            maxApplicationsPerOrder: 1,
          };
    }
    case "experience":
      return null;
    default:
      return null;
  }
}
