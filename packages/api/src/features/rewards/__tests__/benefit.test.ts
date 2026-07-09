import { ruleSchema } from "@loyalty/api/features/promotions/schemas";
import { describe, expect, it } from "vitest";

import { compileRewardRule } from "../benefit";
import { rewardBenefitConfigSchema } from "../schemas";
import { rewardBenefitSummary } from "../format";

describe("compileRewardRule", () => {
  it("freeProduct → 100% off the get side, one application", () => {
    const rule = compileRewardRule({
      type: "freeProduct",
      refs: [{ kind: "product", id: "p1" }],
    });
    expect(rule).not.toBeNull();
    expect(ruleSchema.parse(rule)).toBeTruthy();
    expect(rule).toMatchObject({
      buy: { requirements: [] },
      get: { requirements: [{ refs: [{ kind: "product", id: "p1" }], qty: 1 }] },
      effect: { kind: "percentOff", percent: 100, target: "get" },
      maxApplicationsPerOrder: 1,
    });
  });

  it("amountOff order-wide vs scoped", () => {
    const order = compileRewardRule({ type: "amountOff", amountCents: 500000, refs: [] });
    expect(order).toMatchObject({
      buy: { requirements: [] },
      effect: { kind: "amountOff", amountCents: 500000, target: "order" },
    });
    const scoped = compileRewardRule({
      type: "amountOff",
      amountCents: 500000,
      refs: [{ kind: "category", id: "c1" }],
    });
    expect(scoped).toMatchObject({
      buy: { requirements: [{ refs: [{ kind: "category", id: "c1" }], qty: 1 }] },
      effect: { kind: "amountOff", target: "buy" },
    });
  });

  it("percentOff carries the cap", () => {
    const rule = compileRewardRule({
      type: "percentOff",
      percent: 20,
      refs: [{ kind: "category", id: "c1" }],
      maxDiscountCents: 800000,
    });
    expect(rule?.effect).toMatchObject({ kind: "percentOff", percent: 20, maxDiscountCents: 800000 });
    expect(ruleSchema.parse(rule)).toBeTruthy();
  });

  it("experience compiles to null", () => {
    expect(compileRewardRule({ type: "experience" })).toBeNull();
  });
});

describe("rewardBenefitConfigSchema", () => {
  it("rejects freeProduct without refs and out-of-range percent", () => {
    expect(rewardBenefitConfigSchema.safeParse({ type: "freeProduct", refs: [] }).success).toBe(false);
    expect(
      rewardBenefitConfigSchema.safeParse({ type: "percentOff", percent: 120, refs: [] }).success,
    ).toBe(false);
  });

  it("accepts order-wide amountOff (empty refs)", () => {
    expect(
      rewardBenefitConfigSchema.safeParse({ type: "amountOff", amountCents: 500000, refs: [] })
        .success,
    ).toBe(true);
  });
});

describe("rewardBenefitSummary", () => {
  it("localizes each type, with and without resolved names", () => {
    const free = { type: "freeProduct" as const, refs: [{ kind: "product" as const, id: "p1" }] };
    expect(rewardBenefitSummary(free, "es")).toBe("Producto gratis");
    expect(rewardBenefitSummary(free, "es", new Map([["p1", "Latte"]]))).toBe("Latte gratis");
    expect(rewardBenefitSummary({ type: "amountOff", amountCents: 500000, refs: [] }, "es")).toContain(
      "5.000",
    );
    expect(
      rewardBenefitSummary({ type: "percentOff", percent: 20, refs: [] }, "en"),
    ).toBe("20% off");
    expect(rewardBenefitSummary({ type: "experience" }, "es")).toBe("Experiencia");
    expect(rewardBenefitSummary(null, "es")).toBeNull();
  });
});
