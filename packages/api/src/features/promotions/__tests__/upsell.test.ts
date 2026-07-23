import type { PromoRule } from "@loyalty/db/schema";
import { describe, expect, it } from "vitest";

import { detectPromoUpsell, type VariantCatalog } from "../engine";
import { compileRule } from "../rule-compile";
import { cart, facts, line, NOW, view } from "../__fixtures__/promos";

const NO_VARIANTS: VariantCatalog = {};

describe("detectPromoUpsell", () => {
  it("an already-applicable promo yields no nudge", () => {
    const rule = compileRule({ type: "percentOff", refs: [], percent: 20 });
    const c = cart(line({ productId: "a", unitAmountCents: 10000 }));
    expect(detectPromoUpsell(c, view({ rule }), facts(), NOW, [], NO_VARIANTS)).toBeNull();
  });

  it("customer/time ineligibility is never upsellable", () => {
    const rule = compileRule({ type: "percentOff", refs: [], percent: 20 });
    const c = cart(line({ productId: "a", unitAmountCents: 10000 }));
    // Wrong tier → not a cart nudge.
    const v = view({ rule, audienceType: "tier", tierKey: "gold" });
    expect(detectPromoUpsell(c, v, facts({ customerTierKey: "silver" }), NOW, [], NO_VARIANTS)).toBeNull();
  });

  it("missing get-side → add-item nudge with the missing refs", () => {
    const rule: PromoRule = {
      buy: { requirements: [{ refs: [{ kind: "product", id: "tea" }], qty: 1 }] },
      get: { requirements: [{ refs: [{ kind: "product", id: "cookie" }], qty: 1 }] },
      effect: { kind: "freeUnits", count: 1, target: "get" },
    };
    const c = cart(line({ productId: "tea", unitAmountCents: 12000 }));
    const up = detectPromoUpsell(c, view({ rule }), facts(), NOW, [], NO_VARIANTS);
    expect(up).toEqual({ kind: "add-item", missingGetSide: [{ kind: "product", id: "cookie" }] });
  });

  it("below a rule buy minSubtotal → spend-to-threshold with the gap", () => {
    const rule: PromoRule = {
      buy: { requirements: [], minSubtotalCents: 30000 },
      effect: { kind: "percentOff", percent: 10, target: "order" },
    };
    const c = cart(line({ productId: "a", unitAmountCents: 20000 }));
    const up = detectPromoUpsell(c, view({ rule }), facts(), NOW, [], NO_VARIANTS);
    expect(up).toEqual({ kind: "spend-to-threshold", addCents: 10000 });
  });

  it("below a conditions minPurchase → spend-to-threshold with the gap", () => {
    const rule = compileRule({ type: "percentOff", refs: [], percent: 10 });
    const c = cart(line({ productId: "a", unitAmountCents: 20000 }));
    const v = view({ rule, conditions: { minPurchaseCents: 25000 } });
    const up = detectPromoUpsell(c, v, facts(), NOW, [], NO_VARIANTS);
    expect(up).toEqual({ kind: "spend-to-threshold", addCents: 5000 });
  });

  it("variant-swap: upgrading a line to a pricier sibling unlocks a 2x1", () => {
    // 2x1 on the "large" variant needs two larges. Cart has one large + one
    // small of the same product → swapping the small to large triggers it.
    const rule = compileRule({
      type: "nxm",
      refs: [{ kind: "variant", id: "large" }],
      buyQty: 2,
      payQty: 1,
    });
    const c = cart(
      line({ productId: "milktea", variantId: "large", unitAmountCents: 5000 }),
      line({ productId: "milktea", variantId: "small", unitAmountCents: 3000 }),
    );
    const variants: VariantCatalog = {
      milktea: [
        { variantId: "large", priceCents: 5000 },
        { variantId: "small", priceCents: 3000 },
      ],
    };
    const up = detectPromoUpsell(c, view({ rule }), facts(), NOW, [], variants);
    expect(up).toEqual({
      kind: "variant-swap",
      lineIndex: 1,
      fromVariantId: "small",
      toVariantId: "large",
      extraCents: 2000, // 5000 − 3000
      discountCents: 5000, // 2x1 frees one large
    });
  });

  it("variant-swap preserves modifier deltas in the swapped unit price", () => {
    // The small line carries a +1000 modifier (unit 4000 = 3000 base + 1000).
    // Swapping to large keeps the modifier: 5000 + 1000 = 6000 → extra 2000.
    const rule = compileRule({
      type: "nxm",
      refs: [{ kind: "variant", id: "large" }],
      buyQty: 2,
      payQty: 1,
    });
    const c = cart(
      line({ productId: "milktea", variantId: "large", unitAmountCents: 5000 }),
      line({ productId: "milktea", variantId: "small", unitAmountCents: 4000 }),
    );
    const variants: VariantCatalog = {
      milktea: [
        { variantId: "large", priceCents: 5000 },
        { variantId: "small", priceCents: 3000 },
      ],
    };
    const up = detectPromoUpsell(c, view({ rule }), facts(), NOW, [], variants);
    expect(up).toMatchObject({ kind: "variant-swap", toVariantId: "large", extraCents: 2000 });
  });

  it("no swap when the discount can't beat the upgrade cost", () => {
    // The large costs 20000 more but the freed unit is only worth 20000 — the
    // upgrade equals the discount → net 0 → no credible nudge.
    const rule = compileRule({
      type: "nxm",
      refs: [{ kind: "variant", id: "large" }],
      buyQty: 2,
      payQty: 1,
    });
    const c = cart(
      line({ productId: "milktea", variantId: "large", unitAmountCents: 20000 }),
      line({ productId: "milktea", variantId: "small", unitAmountCents: 0 }),
    );
    const variants: VariantCatalog = {
      milktea: [
        { variantId: "large", priceCents: 20000 },
        { variantId: "small", priceCents: 0 },
      ],
    };
    expect(detectPromoUpsell(c, view({ rule }), facts(), NOW, [], variants)).toBeNull();
  });

  it("no swap for a product with no sibling variants", () => {
    const rule = compileRule({
      type: "nxm",
      refs: [{ kind: "variant", id: "large" }],
      buyQty: 2,
      payQty: 1,
    });
    const c = cart(line({ productId: "milktea", variantId: "large", unitAmountCents: 5000 }));
    const variants: VariantCatalog = { milktea: [{ variantId: "large", priceCents: 5000 }] };
    expect(detectPromoUpsell(c, view({ rule }), facts(), NOW, [], variants)).toBeNull();
  });
});
