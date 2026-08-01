import type { RewardBenefitConfig } from "@loyalty/db/schema";

import {
  computeEffect,
  matchRule,
  subtotalCents,
  toExclusions,
  unitsMatching,
  type Cart,
  type UnitExclusion,
} from "../promotions/engine";
import { compileRewardRule } from "./benefit";
import { pickUpgrade, type UpgradePlan } from "./variant-swap";

export type RewardCartEvaluation =
  | {
      ok: true;
      discountCents: number;
      exclusions: UnitExclusion[];
      /** Presentation-only: the line the benefit lands on when it produces no
       *  exclusion (a free add-on waives a price without consuming a unit). */
      target?: { lineIndex: number; label?: string };
      /** `variantUpgrade` only: the unit to move up. The caller applies it —
       *  exclusions have to be expressed against post-split line indices. */
      upgrade?: UpgradePlan;
    }
  | { ok: false; reason: "reward-item-not-in-cart" | "reward-no-upgrade-available" };

/**
 * Compute a reward's discount over the (enriched) cart and the units it
 * consumed, so promos can be evaluated on the remainder. Pure — the caller
 * stitches categories/modifiers first.
 *
 * - `experience` → $0, no exclusions (recorded, no ticket effect).
 * - `freeProduct` → the CHEAPEST matching unit free (paid-with-points reward →
 *   cheapest, unlike promo crossSell's most-expensive-free); its item must be
 *   in the cart.
 * - scoped `amountOff`/`percentOff` → discount over the matched unit, which is
 *   then excluded; its item must be in the cart.
 * - order-wide `amountOff`/`percentOff` → voucher over the whole order, no unit
 *   exclusions (promos still see the full cart; net clamps ≥ 0).
 */
export function evaluateRewardForCart(
  reward: { benefit: RewardBenefitConfig | null },
  cart: Cart,
): RewardCartEvaluation {
  const benefit = reward.benefit;
  if (!benefit || benefit.type === "experience") {
    return { ok: true, discountCents: 0, exclusions: [] };
  }

  if (benefit.type === "freeProduct") {
    const candidates = unitsMatching(cart, benefit.refs);
    if (candidates.length === 0) return { ok: false, reason: "reward-item-not-in-cart" };
    const cheapest = candidates.reduce((a, b) => (b.amountCents < a.amountCents ? b : a));
    return { ok: true, discountCents: cheapest.amountCents, exclusions: toExclusions([cheapest]) };
  }

  if (benefit.type === "freeAddon") {
    // The cashier adds the add-on to a line; this waives its price. `addonId`
    // null = any add-on present. Cheapest matching add-on goes free. Add-ons are
    // not promo-matchable units, so no exclusions are needed (no double-count).
    const candidates = cart.lines.flatMap((l, lineIndex) =>
      (l.addons ?? [])
        .filter((a) => benefit.addonId == null || a.id === benefit.addonId)
        .map((a) => ({ lineIndex, amountCents: a.priceDeltaCents, label: a.name })),
    );
    if (candidates.length === 0) return { ok: false, reason: "reward-item-not-in-cart" };
    const cheapest = candidates.reduce((a, b) => (b.amountCents < a.amountCents ? b : a));
    // No exclusions — add-ons aren't promo-matchable units, so there's nothing
    // to double-count. `target` is presentation only: without it the register
    // showed a bare "Recompensa − $1.000" and no marker on the line the add-on
    // sits on, which is the one thing the cashier needs to know.
    return {
      ok: true,
      discountCents: cheapest.amountCents,
      exclusions: [],
      target: { lineIndex: cheapest.lineIndex, label: cheapest.label },
    };
  }

  if (benefit.type === "variantUpgrade") {
    // Upgrade targets are pre-resolved onto the lines by the service (it needs
    // the variant graph). Eligible = a line is at the SOURCE variant and a
    // pricier sibling exists — the reward then moves it up, so the customer
    // brings the Mediano rather than being expected to have ordered the Grande.
    //
    // The plan is returned rather than applied: the split changes line indices,
    // so exclusions can only be built after the caller applies it.
    const plan = pickUpgrade(cart);
    if (!plan) return { ok: false, reason: "reward-no-upgrade-available" };
    return { ok: true, discountCents: plan.deltaCents, exclusions: [], upgrade: plan };
  }

  const rule = compileRewardRule(benefit);
  if (!rule) return { ok: true, discountCents: 0, exclusions: [] };
  const scoped = benefit.refs.length > 0;

  const match = matchRule(cart, rule);
  if (match.applications.length === 0) {
    // A scoped discount needs its item present; an order-wide voucher on an
    // empty cart simply discounts nothing.
    return scoped
      ? { ok: false, reason: "reward-item-not-in-cart" }
      : { ok: true, discountCents: 0, exclusions: [] };
  }

  const effect = computeEffect(cart, rule, match);
  const discountCents = Math.min(effect.discountCents, subtotalCents(cart.lines));
  const exclusions = scoped
    ? toExclusions(match.applications.flatMap((a) => a.buyUnits))
    : [];
  return { ok: true, discountCents, exclusions };
}
