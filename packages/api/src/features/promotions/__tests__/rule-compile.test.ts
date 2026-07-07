import { describe, expect, it } from "vitest";

import { ruleSchema } from "../schemas";
import { benefitConfigSchema, compileRule, decompileRule, type BenefitConfig } from "../rule-compile";

const CONFIGS: BenefitConfig[] = [
  { type: "percentOff", refs: [{ kind: "category", id: "c1" }], percent: 20, maxDiscountCents: 8000 },
  { type: "percentOff", refs: [], percent: 10 },
  { type: "amountOff", refs: [{ kind: "product", id: "p1" }], amountCents: 2000 },
  { type: "nxm", refs: [{ kind: "product", id: "p1" }], buyQty: 3, payQty: 2, maxApplicationsPerOrder: 2 },
  { type: "secondUnit", refs: [{ kind: "variant", id: "v1" }], percent: 50 },
  {
    type: "bundle",
    requirements: [
      { refs: [{ kind: "product", id: "p1" }], qty: 1 },
      { refs: [{ kind: "product", id: "p2" }], qty: 1 },
    ],
    benefit: { kind: "percent", percent: 15 },
  },
  {
    type: "combo",
    requirements: [
      { refs: [{ kind: "category", id: "mains" }], qty: 1 },
      { refs: [{ kind: "category", id: "drinks" }], qty: 1 },
    ],
    priceCents: 20000,
  },
  {
    type: "crossSell",
    buy: [{ refs: [{ kind: "product", id: "mouse" }], qty: 1 }],
    get: [{ refs: [{ kind: "modifierOption", id: "top" }], qty: 1 }],
    percent: 100,
    maxApplicationsPerOrder: 1,
  },
  { type: "cartThreshold", minSubtotalCents: 200000, benefit: { kind: "amount", amountCents: 20000 } },
  {
    type: "volumeTiered",
    refs: [{ kind: "category", id: "teas" }],
    tiers: [
      { minQty: 1, percent: 5 },
      { minQty: 3, percent: 15 },
    ],
  },
  { type: "pointsMultiplier", refs: [], multiplier: 2 },
];

describe("compileRule / decompileRule", () => {
  it.each(CONFIGS.map((c) => [c.type, c] as const))(
    "round-trips %s through the rule model",
    (_type, config) => {
      const rule = compileRule(config);
      expect(ruleSchema.parse(rule)).toBeTruthy();
      expect(decompileRule(config.type, rule)).toEqual(config);
    },
  );

  it("forces cartThreshold to a single application", () => {
    const rule = compileRule({
      type: "cartThreshold",
      minSubtotalCents: 1000,
      benefit: { kind: "percent", percent: 10 },
    });
    expect(rule.maxApplicationsPerOrder).toBe(1);
    expect(rule.buy.minSubtotalCents).toBe(1000);
  });

  it("rejects nxm configs where payQty is not below buyQty", () => {
    expect(
      benefitConfigSchema.safeParse({
        type: "nxm",
        refs: [],
        buyQty: 2,
        payQty: 2,
      }).success,
    ).toBe(false);
  });

  it("returns null when a rule does not fit the requested type", () => {
    const rule = compileRule({ type: "percentOff", refs: [], percent: 10 });
    expect(decompileRule("combo", rule)).toBeNull();
    expect(decompileRule("crossSell", rule)).toBeNull();
  });
});
