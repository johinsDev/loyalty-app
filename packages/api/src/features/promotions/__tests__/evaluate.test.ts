import { describe, expect, it } from "vitest";

import { evaluatePromo, pickBest, type PromoEvaluation } from "../engine";
import { compileRule } from "../rule-compile";
import { cart, facts, line, NOW, view } from "../__fixtures__/promos";

const run = (rule: ReturnType<typeof compileRule>, c = defaultCart(), v = {}) =>
  evaluatePromo(c, view({ rule, ...v }), facts(), NOW);

const defaultCart = () =>
  cart(
    line({ productId: "classic", categoryIds: ["milk-teas"], unitAmountCents: 12000 }),
    line({ productId: "taro", categoryIds: ["milk-teas"], unitAmountCents: 14000 }),
    line({ productId: "cookie", categoryIds: ["snacks"], unitAmountCents: 6000 }),
  );

describe("evaluatePromo per curated type", () => {
  it("percentOff on a category discounts only matching units", () => {
    const rule = compileRule({
      type: "percentOff",
      refs: [{ kind: "category", id: "milk-teas" }],
      percent: 20,
    });
    const result = run(rule);
    // 20% of (12000 + 14000)
    expect(result.discountCents).toBe(5200);
    expect(result.applications).toBe(2);
  });

  it("percentOff order-wide respects the cap", () => {
    const rule = compileRule({ type: "percentOff", refs: [], percent: 50, maxDiscountCents: 9000 });
    const result = run(rule);
    expect(result.discountCents).toBe(9000); // 50% of 32000 capped
    expect(result.applications).toBe(1);
  });

  it("amountOff order-wide clamps to the subtotal", () => {
    const rule = compileRule({ type: "amountOff", refs: [], amountCents: 99999999 });
    expect(run(rule).discountCents).toBe(32000);
  });

  it("nxm 2x1 pairs most-expensive-first and frees the cheapest of each pair", () => {
    const rule = compileRule({
      type: "nxm",
      refs: [{ kind: "category", id: "teas" }],
      buyQty: 2,
      payQty: 1,
    });
    const c = cart(
      line({ productId: "a", categoryIds: ["teas"], unitAmountCents: 4000 }),
      line({ productId: "b", categoryIds: ["teas"], unitAmountCents: 3000 }),
      line({ productId: "c", categoryIds: ["teas"], unitAmountCents: 2000 }),
      line({ productId: "d", categoryIds: ["teas"], unitAmountCents: 1000 }),
    );
    const result = evaluatePromo(c, view({ rule }), facts(), NOW);
    // (4000,3000) frees 3000; (2000,1000) frees 1000.
    expect(result.discountCents).toBe(4000);
    expect(result.applications).toBe(2);
  });

  it("nxm with 7 units applies twice for buyQty 3 and leaves the remainder", () => {
    const rule = compileRule({ type: "nxm", refs: [], buyQty: 3, payQty: 2 });
    const c = cart(line({ productId: "a", unitAmountCents: 1000, qty: 7 }));
    const result = evaluatePromo(c, view({ rule }), facts(), NOW);
    expect(result.applications).toBe(2);
    expect(result.discountCents).toBe(2000);
  });

  it("secondUnit discounts the cheapest of each pair at X%", () => {
    const rule = compileRule({
      type: "secondUnit",
      refs: [{ kind: "category", id: "milk-teas" }],
      percent: 50,
    });
    const result = run(rule);
    // Pair (14000, 12000): 50% off the 12000 one.
    expect(result.discountCents).toBe(6000);
    expect(result.applications).toBe(1);
  });

  it("secondUnit with an odd unit out applies to complete pairs only", () => {
    const rule = compileRule({ type: "secondUnit", refs: [], percent: 50 });
    const c = cart(line({ productId: "a", unitAmountCents: 4000, qty: 3 }));
    const result = evaluatePromo(c, view({ rule }), facts(), NOW);
    expect(result.applications).toBe(1);
    expect(result.discountCents).toBe(2000);
  });

  it("bundle discounts the matched set", () => {
    const rule = compileRule({
      type: "bundle",
      requirements: [
        { refs: [{ kind: "product", id: "phone" }], qty: 1 },
        { refs: [{ kind: "product", id: "case" }], qty: 1 },
        { refs: [{ kind: "product", id: "protector" }], qty: 1 },
      ],
      benefit: { kind: "percent", percent: 15 },
    });
    const c = cart(
      line({ productId: "phone", unitAmountCents: 100000 }),
      line({ productId: "case", unitAmountCents: 10000 }),
      line({ productId: "protector", unitAmountCents: 5000 }),
      line({ productId: "other", unitAmountCents: 99999 }),
    );
    const result = evaluatePromo(c, view({ rule }), facts(), NOW);
    expect(result.discountCents).toBe(Math.round(115000 * 0.15));
  });

  it("combo charges a fixed price for the set and rejects partial sets", () => {
    const rule = compileRule({
      type: "combo",
      requirements: [
        { refs: [{ kind: "category", id: "mains" }], qty: 1 },
        { refs: [{ kind: "category", id: "drinks" }], qty: 1 },
      ],
      priceCents: 20000,
    });
    const fullSet = cart(
      line({ productId: "burger", categoryIds: ["mains"], unitAmountCents: 18000 }),
      line({ productId: "soda", categoryIds: ["drinks"], unitAmountCents: 7000 }),
    );
    expect(evaluatePromo(fullSet, view({ rule }), facts(), NOW).discountCents).toBe(5000);

    const partial = cart(line({ productId: "burger", categoryIds: ["mains"], unitAmountCents: 18000 }));
    const missed = evaluatePromo(partial, view({ rule }), facts(), NOW);
    expect(missed.eligible).toBe(false);
    expect(missed.reason).toBe("no-matching-items");
  });

  it("crossSell frees a get-side modifier when the buy side is met", () => {
    const rule = compileRule({
      type: "crossSell",
      buy: [{ refs: [{ kind: "variant", id: "v-large" }], qty: 1 }],
      get: [{ refs: [{ kind: "modifierOption", id: "tapioca" }], qty: 1 }],
      percent: 100,
      maxApplicationsPerOrder: 1,
    });
    const c = cart(
      line({
        productId: "classic",
        variantId: "v-large",
        unitAmountCents: 15000,
        modifierOptions: [{ id: "tapioca", priceDeltaCents: 2000 }],
      }),
    );
    const result = evaluatePromo(c, view({ rule }), facts(), NOW);
    expect(result.discountCents).toBe(2000);
  });

  it("crossSell surfaces the upsell hint when the get side is missing", () => {
    const rule = compileRule({
      type: "crossSell",
      buy: [{ refs: [{ kind: "product", id: "mouse" }], qty: 1 }],
      get: [{ refs: [{ kind: "product", id: "pad" }], qty: 1 }],
      percent: 50,
      maxApplicationsPerOrder: 1,
    });
    const result = evaluatePromo(
      cart(line({ productId: "mouse", unitAmountCents: 80000 })),
      view({ rule }),
      facts(),
      NOW,
    );
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("missing-get-side");
    expect(result.missingGetSide).toEqual([{ kind: "product", id: "pad" }]);
  });

  it("cartThreshold discounts once at/above the threshold, never below", () => {
    const rule = compileRule({
      type: "cartThreshold",
      minSubtotalCents: 30000,
      benefit: { kind: "amount", amountCents: 5000 },
    });
    expect(run(rule).discountCents).toBe(5000); // subtotal 32000
    const below = evaluatePromo(
      cart(line({ productId: "a", unitAmountCents: 29999 })),
      view({ rule }),
      facts(),
      NOW,
    );
    expect(below.eligible).toBe(false);
    expect(below.reason).toBe("below-threshold");
  });

  it("volumeTiered picks the highest tier by matched quantity", () => {
    const rule = compileRule({
      type: "volumeTiered",
      refs: [{ kind: "category", id: "teas" }],
      tiers: [
        { minQty: 1, percent: 5 },
        { minQty: 3, percent: 15 },
        { minQty: 5, percent: 25 },
      ],
    });
    const teas = (qty: number) =>
      cart(line({ productId: "a", categoryIds: ["teas"], unitAmountCents: 1000, qty }));
    expect(evaluatePromo(teas(1), view({ rule }), facts(), NOW).discountCents).toBe(50);
    expect(evaluatePromo(teas(3), view({ rule }), facts(), NOW).discountCents).toBe(450);
    expect(evaluatePromo(teas(5), view({ rule }), facts(), NOW).discountCents).toBe(1250);
  });

  it("pointsMultiplier yields no discount and passes the multiplier through", () => {
    const rule = compileRule({ type: "pointsMultiplier", refs: [], multiplier: 2 });
    const result = run(rule);
    expect(result.discountCents).toBe(0);
    expect(result.pointsMultiplier).toBe(2);
  });

  it("enforces min purchase from conditions", () => {
    const rule = compileRule({ type: "percentOff", refs: [], percent: 10 });
    const result = evaluatePromo(
      cart(line({ productId: "a", unitAmountCents: 1000 })),
      view({ rule, conditions: { minPurchaseCents: 5000 } }),
      facts(),
      NOW,
    );
    expect(result.reason).toBe("below-min-purchase");
  });
});

describe("pickBest", () => {
  const evaluation = (over: Partial<PromoEvaluation>): PromoEvaluation => ({
    eligible: true,
    reason: null,
    discountCents: 0,
    pointsMultiplier: 1,
    applications: 1,
    missingGetSide: [],
    ...over,
  });

  it("prefers discount, then multiplier, then sortOrder", () => {
    const items = [
      { id: "a", sortOrder: 0, evaluation: evaluation({ discountCents: 1000 }) },
      { id: "b", sortOrder: 1, evaluation: evaluation({ discountCents: 2000 }) },
      { id: "c", sortOrder: 2, evaluation: evaluation({ discountCents: 2000, pointsMultiplier: 2 }) },
      { id: "d", sortOrder: 0, evaluation: evaluation({ eligible: false, discountCents: 9999 }) },
    ];
    expect(pickBest(items)?.id).toBe("c");
    expect(
      pickBest([
        { id: "x", sortOrder: 5, evaluation: evaluation({ discountCents: 100 }) },
        { id: "y", sortOrder: 1, evaluation: evaluation({ discountCents: 100 }) },
      ])?.id,
    ).toBe("y");
    expect(pickBest([])).toBeNull();
  });
});
