import { describe, expect, it } from "vitest";

import { applyStampProgress, evaluateStampEligibility } from "../eligibility";

const base = {
  stampsOn: true,
  isRedemptionOnly: false,
  netPriceCents: 12_000,
  currency: "COP",
  minAmount: null,
  eligibleCategoryIds: null,
  cartCategoryIds: null,
};

describe("evaluateStampEligibility", () => {
  it("passes with no rules configured", () => {
    expect(evaluateStampEligibility(base)).toEqual({ eligible: true, reason: "ok" });
  });

  it("rejects when the stamps track is paused", () => {
    expect(evaluateStampEligibility({ ...base, stampsOn: false }).reason).toBe(
      "paused",
    );
  });

  it("rejects a redemption-only ticket", () => {
    expect(
      evaluateStampEligibility({ ...base, isRedemptionOnly: true, netPriceCents: 0 })
        .reason,
    ).toBe("redemption-only");
  });

  describe("minimum amount", () => {
    it("treats a missing currency entry as no minimum", () => {
      expect(
        evaluateStampEligibility({ ...base, minAmount: { USD: 500 } }).eligible,
      ).toBe(true);
    });

    it("treats a 0 entry as no minimum", () => {
      expect(
        evaluateStampEligibility({ ...base, minAmount: { COP: 0 } }).eligible,
      ).toBe(true);
    });

    it("passes when the net equals the minimum", () => {
      expect(
        evaluateStampEligibility({ ...base, minAmount: { COP: 12_000 } }).eligible,
      ).toBe(true);
    });

    it("rejects below the minimum", () => {
      expect(
        evaluateStampEligibility({ ...base, minAmount: { COP: 12_001 } }).reason,
      ).toBe("below-min");
    });

    it("uses the purchase currency's entry", () => {
      expect(
        evaluateStampEligibility({
          ...base,
          currency: "USD",
          netPriceCents: 300,
          minAmount: { COP: 10_000, USD: 500 },
        }).reason,
      ).toBe("below-min");
    });
  });

  describe("categories", () => {
    const allowed = ["cat-drinks"];

    it("item-less purchases always pass the category rule", () => {
      expect(
        evaluateStampEligibility({
          ...base,
          eligibleCategoryIds: allowed,
          cartCategoryIds: null,
        }).eligible,
      ).toBe(true);
    });

    it("empty allowlist means every category is eligible", () => {
      expect(
        evaluateStampEligibility({
          ...base,
          eligibleCategoryIds: [],
          cartCategoryIds: ["cat-toppings"],
        }).eligible,
      ).toBe(true);
    });

    it("counts a cart with at least one eligible item", () => {
      expect(
        evaluateStampEligibility({
          ...base,
          eligibleCategoryIds: allowed,
          cartCategoryIds: ["cat-toppings", "cat-drinks"],
        }).eligible,
      ).toBe(true);
    });

    it("rejects a cart with no eligible items", () => {
      expect(
        evaluateStampEligibility({
          ...base,
          eligibleCategoryIds: allowed,
          cartCategoryIds: ["cat-toppings"],
        }).reason,
      ).toBe("category");
    });
  });

  it("applies min before category (redemption-only before both)", () => {
    expect(
      evaluateStampEligibility({
        ...base,
        netPriceCents: 100,
        minAmount: { COP: 5_000 },
        eligibleCategoryIds: ["cat-drinks"],
        cartCategoryIds: ["cat-toppings"],
      }).reason,
    ).toBe("below-min");
  });
});

describe("applyStampProgress", () => {
  it("per=1 always grants and keeps the counter at 0", () => {
    expect(applyStampProgress(0, 1)).toEqual({ grant: true, nextPending: 0 });
  });

  it("per=2 grants every second purchase", () => {
    expect(applyStampProgress(0, 2)).toEqual({ grant: false, nextPending: 1 });
    expect(applyStampProgress(1, 2)).toEqual({ grant: true, nextPending: 0 });
  });

  it("per=3 accumulates then resets", () => {
    expect(applyStampProgress(0, 3)).toEqual({ grant: false, nextPending: 1 });
    expect(applyStampProgress(1, 3)).toEqual({ grant: false, nextPending: 2 });
    expect(applyStampProgress(2, 3)).toEqual({ grant: true, nextPending: 0 });
  });

  it("a lowered threshold grants immediately for over-accumulated progress", () => {
    expect(applyStampProgress(2, 2)).toEqual({ grant: true, nextPending: 0 });
  });

  it("clamps a nonsensical per below 1", () => {
    expect(applyStampProgress(0, 0)).toEqual({ grant: true, nextPending: 0 });
  });
});
