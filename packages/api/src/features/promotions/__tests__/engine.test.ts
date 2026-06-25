import { describe, expect, it } from "vitest";

import {
  computeDiscount,
  ineligibleReason,
  type Cart,
  type EligibilityContext,
  type PromoLike,
} from "../engine";

const line = (p: Partial<Cart["lines"][number]> = {}) => ({
  productId: "milk-tea",
  qty: 1,
  unitAmountCents: 1500,
  ...p,
});
const cart = (lines: Cart["lines"]): Cart => ({ currency: "COP", lines });

describe("computeDiscount", () => {
  it("percentage with cap", () => {
    const promo: PromoLike = {
      type: "percentage",
      benefit: { percent: 50, maxDiscountCents: 500 },
      scopeKind: "order",
      scope: null,
      conditions: null,
    };
    expect(computeDiscount(cart([line({ unitAmountCents: 2000 })]), promo).discountCents).toBe(500);
  });

  it("fixed never exceeds the scoped subtotal", () => {
    const promo: PromoLike = {
      type: "fixed",
      benefit: { amountCents: 5000 },
      scopeKind: "order",
      scope: null,
      conditions: null,
    };
    expect(computeDiscount(cart([line({ unitAmountCents: 1500 })]), promo).discountCents).toBe(1500);
  });

  it("nForM (2x1) frees the cheapest unit per group", () => {
    const promo: PromoLike = {
      type: "nForM",
      benefit: { buyQty: 2, payQty: 1 },
      scopeKind: "products",
      scope: { productIds: ["milk-tea"] },
      conditions: null,
    };
    // two units: 1500 + 2000 → cheapest (1500) free.
    const c = cart([line({ unitAmountCents: 1500 }), line({ unitAmountCents: 2000 })]);
    expect(computeDiscount(c, promo).discountCents).toBe(1500);
  });

  it("nForM (3x2) frees one of every three", () => {
    const promo: PromoLike = {
      type: "nForM",
      benefit: { buyQty: 3, payQty: 2 },
      scopeKind: "order",
      scope: null,
      conditions: null,
    };
    const c = cart([line({ qty: 3, unitAmountCents: 1000 })]);
    expect(computeDiscount(c, promo).discountCents).toBe(1000);
  });

  it("freeItem discounts the cheapest matching unit", () => {
    const promo: PromoLike = {
      type: "freeItem",
      benefit: { freeRef: { kind: "modifier", id: "boba" } },
      scopeKind: "order",
      scope: null,
      conditions: null,
    };
    const c = cart([line({ modifierOptionIds: ["boba"], unitAmountCents: 2000 })]);
    expect(computeDiscount(c, promo).discountCents).toBe(2000);
    expect(computeDiscount(cart([line()]), promo).discountCents).toBe(0);
  });

  it("pointsMultiplier yields no money discount", () => {
    const promo: PromoLike = {
      type: "pointsMultiplier",
      benefit: { multiplier: 2 },
      scopeKind: "order",
      scope: null,
      conditions: null,
    };
    const r = computeDiscount(cart([line()]), promo);
    expect(r.discountCents).toBe(0);
    expect(r.pointsMultiplier).toBe(2);
  });

  it("category scope only discounts matching lines", () => {
    const promo: PromoLike = {
      type: "percentage",
      benefit: { percent: 100 },
      scopeKind: "categories",
      scope: { categoryIds: ["matcha"] },
      conditions: null,
    };
    const c = cart([
      line({ productId: "matcha-latte", categoryIds: ["matcha"], unitAmountCents: 1500 }),
      line({ productId: "milk-tea", categoryIds: ["milk-tea"], unitAmountCents: 1500 }),
    ]);
    expect(computeDiscount(c, promo).discountCents).toBe(1500);
  });
});

describe("ineligibleReason", () => {
  const base: EligibilityContext = {
    now: new Date("2026-06-15T15:00:00"), // a Monday, 15:00 local
    status: "published",
    startsAt: null,
    endsAt: null,
    audienceType: "all",
    tierKey: null,
    audienceCustomerIds: null,
    conditions: null,
    customerTierKey: null,
    customerId: "c1",
    customerPurchaseCount: 3,
    redemptionsTotal: 0,
    redemptionsByCustomer: 0,
  };

  it("eligible by default", () => {
    expect(ineligibleReason(base)).toBeNull();
  });
  it("not published", () => {
    expect(ineligibleReason({ ...base, status: "draft" })).toBe("not-published");
  });
  it("outside window", () => {
    expect(ineligibleReason({ ...base, startsAt: new Date("2026-07-01") })).toBe("outside-window");
  });
  it("wrong day", () => {
    expect(ineligibleReason({ ...base, conditions: { daysOfWeek: [0] } })).toBe("wrong-day");
  });
  it("outside hours", () => {
    expect(
      ineligibleReason({ ...base, conditions: { hoursFrom: "16:00", hoursTo: "18:00" } }),
    ).toBe("outside-hours");
  });
  it("wrong tier", () => {
    expect(ineligibleReason({ ...base, audienceType: "tier", tierKey: "oro" })).toBe("wrong-tier");
  });
  it("not targeted", () => {
    expect(
      ineligibleReason({ ...base, audienceType: "specific", audienceCustomerIds: ["other"] }),
    ).toBe("not-targeted");
  });
  it("first purchase only", () => {
    expect(ineligibleReason({ ...base, conditions: { firstPurchaseOnly: true } })).toBe(
      "not-first-purchase",
    );
  });
  it("max uses + per customer", () => {
    expect(
      ineligibleReason({ ...base, conditions: { maxUsesTotal: 5 }, redemptionsTotal: 5 }),
    ).toBe("max-uses-reached");
    expect(
      ineligibleReason({ ...base, conditions: { maxPerCustomer: 1 }, redemptionsByCustomer: 1 }),
    ).toBe("max-per-customer-reached");
  });
  it("below min purchase + no scoped items (cart)", () => {
    expect(
      ineligibleReason({
        ...base,
        conditions: { minPurchaseCents: 5000 },
        cart: { currency: "COP", lines: [{ productId: "x", qty: 1, unitAmountCents: 1000 }] },
        scopeKind: "order",
      }),
    ).toBe("below-min-purchase");
    expect(
      ineligibleReason({
        ...base,
        cart: { currency: "COP", lines: [{ productId: "x", qty: 1, unitAmountCents: 1000 }] },
        scopeKind: "products",
        scope: { productIds: ["other"] },
      }),
    ).toBe("no-scoped-items");
  });
});
