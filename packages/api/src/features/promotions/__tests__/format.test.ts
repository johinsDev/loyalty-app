import { describe, expect, it } from "vitest";

import { benefitSummary } from "../format";
import { compileRule } from "../rule-compile";

describe("benefitSummary", () => {
  it("localizes percentOff order-wide", () => {
    const rule = compileRule({ type: "percentOff", refs: [], percent: 20 });
    expect(benefitSummary("percentOff", rule, "es")).toBe("20% en toda tu compra");
    expect(benefitSummary("percentOff", rule, "en")).toBe("20% off your order");
  });

  it("uses resolved names when every ref resolves", () => {
    const rule = compileRule({
      type: "percentOff",
      refs: [{ kind: "category", id: "c1" }],
      percent: 20,
    });
    const names = new Map([["c1", "Frutales"]]);
    expect(benefitSummary("percentOff", rule, "es", names)).toBe("20% en Frutales");
    expect(benefitSummary("percentOff", rule, "es")).toBe("20% en productos seleccionados");
  });

  it("states the discount ceiling — it is a promise the register has to keep", () => {
    // "30% en Studio Showcase" on a $21.000 drink promises $6.300; the register
    // takes $3.000. The cap belongs in the sentence the cashier reads aloud.
    const rule = compileRule({
      type: "percentOff",
      refs: [{ kind: "product", id: "p1" }],
      percent: 30,
      maxDiscountCents: 300000,
    });
    const names = new Map([["p1", "Studio Showcase"]]);
    // `toContain`, because Intl separates the COP symbol with a non-breaking
    // space — the same reason the money test below matches on the digits.
    const es = benefitSummary("percentOff", rule, "es", names);
    expect(es).toContain("30% en Studio Showcase");
    expect(es).toContain("máx");
    expect(es).toContain("3.000");
    expect(benefitSummary("percentOff", rule, "en", names)).toContain("max");
  });

  it("scopes the second unit with 'de', not a second 'en'", () => {
    const rule = compileRule({
      type: "secondUnit",
      refs: [{ kind: "category", id: "c1" }],
      percent: 50,
    });
    const names = new Map([["c1", "General"]]);
    // Was "50% en la 2.ª unidad en General".
    expect(benefitSummary("secondUnit", rule, "es", names)).toBe("50% en la 2.ª unidad de General");
  });

  it("labels nxm with the NxM shape", () => {
    const rule = compileRule({ type: "nxm", refs: [], buyQty: 2, payQty: 1 });
    expect(benefitSummary("nxm", rule, "es")).toBe("2×1: el más barato va gratis");
    expect(benefitSummary("nxm", rule, "en")).toBe("2×1: cheapest one free");
  });

  it("formats money in COP without decimals", () => {
    const rule = compileRule({
      type: "cartThreshold",
      minSubtotalCents: 3000000,
      benefit: { kind: "amount", amountCents: 500000 },
    });
    const es = benefitSummary("cartThreshold", rule, "es");
    expect(es).toContain("30.000");
    expect(es).toContain("5.000");
  });

  it("describes free cross-sell gifts", () => {
    const rule = compileRule({
      type: "crossSell",
      buy: [{ refs: [{ kind: "product", id: "p1" }], qty: 1 }],
      get: [{ refs: [{ kind: "modifierOption", id: "m1" }], qty: 1 }],
      percent: 100,
    });
    expect(benefitSummary("crossSell", rule, "es")).toBe("Producto de regalo con tu compra");
    expect(benefitSummary("crossSell", rule, "es", new Map([["m1", "Tapioca"], ["p1", "Té"]]))).toBe(
      "Tapioca gratis con tu compra",
    );
  });

  it("summarizes tiers by the top percent and multipliers as xN", () => {
    const tiered = compileRule({
      type: "volumeTiered",
      refs: [],
      tiers: [
        { minQty: 1, percent: 5 },
        { minQty: 5, percent: 25 },
      ],
    });
    expect(benefitSummary("volumeTiered", tiered, "es")).toBe("Hasta 25% off por cantidad");

    const points = compileRule({ type: "pointsMultiplier", refs: [], multiplier: 2 });
    expect(benefitSummary("pointsMultiplier", points, "es")).toBe("x2 puntos en tu compra");
    expect(benefitSummary("pointsMultiplier", points, "en")).toBe("2x points on your purchase");
  });

  it("returns null without a type or rule", () => {
    expect(benefitSummary(null, null, "es")).toBeNull();
    expect(benefitSummary("percentOff", null, "es")).toBeNull();
  });
});
