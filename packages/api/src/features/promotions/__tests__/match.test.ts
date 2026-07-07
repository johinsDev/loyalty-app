import { describe, expect, it } from "vitest";

import { expandUnits, matchRule } from "../engine";
import { cart, line } from "../__fixtures__/promos";

describe("expandUnits", () => {
  it("expands qty into product units plus modifier units per qty", () => {
    const units = expandUnits(
      cart(
        line({
          productId: "a",
          unitAmountCents: 1000,
          qty: 2,
          modifierOptions: [{ id: "top", priceDeltaCents: 300 }],
        }),
      ),
    );
    expect(units).toHaveLength(4);
    expect(units.filter((u) => u.source === "product")).toHaveLength(2);
    expect(
      units.filter((u) => u.source === "modifierOption" && u.amountCents === 300),
    ).toHaveLength(2);
  });
});

describe("matchRule", () => {
  it("satisfies a requirement with OR across refs", () => {
    const result = matchRule(
      cart(line({ productId: "a", unitAmountCents: 1000 }), line({ productId: "b", unitAmountCents: 2000 })),
      {
        buy: {
          requirements: [
            {
              refs: [
                { kind: "product", id: "a" },
                { kind: "product", id: "b" },
              ],
              qty: 2,
            },
          ],
        },
        effect: { kind: "freeUnits", count: 1, target: "buy" },
      },
    );
    expect(result.applications).toHaveLength(1);
    expect(result.applications[0]?.buyUnits).toHaveLength(2);
  });

  it("requires every requirement (AND) with distinct units", () => {
    const rule = {
      buy: {
        requirements: [
          { refs: [{ kind: "product" as const, id: "a" }], qty: 1 },
          { refs: [{ kind: "product" as const, id: "a" }], qty: 1 },
        ],
      },
      effect: { kind: "fixedPrice" as const, priceCents: 1 },
    };
    expect(matchRule(cart(line({ productId: "a", unitAmountCents: 1000 })), rule).applications).toHaveLength(0);
    expect(
      matchRule(cart(line({ productId: "a", unitAmountCents: 1000, qty: 2 })), rule).applications,
    ).toHaveLength(1);
  });

  it("consumes most-expensive-first and repeats while satisfiable", () => {
    const result = matchRule(
      cart(
        line({ productId: "a", unitAmountCents: 1000 }),
        line({ productId: "b", unitAmountCents: 3000 }),
        line({ productId: "c", unitAmountCents: 2000 }),
      ),
      {
        buy: { requirements: [{ refs: [], qty: 1 }] },
        effect: { kind: "percentOff", percent: 10, target: "buy" },
      },
    );
    expect(result.applications.map((a) => a.buyUnits[0]?.amountCents)).toEqual([3000, 2000, 1000]);
  });

  it("caps applications at maxApplicationsPerOrder", () => {
    const result = matchRule(cart(line({ productId: "a", unitAmountCents: 1000, qty: 5 })), {
      buy: { requirements: [{ refs: [{ kind: "product", id: "a" }], qty: 2 }] },
      effect: { kind: "freeUnits", count: 1, target: "buy" },
      maxApplicationsPerOrder: 1,
    });
    expect(result.applications).toHaveLength(1);
  });

  it("never reuses a unit across applications or buy/get", () => {
    // 3 units of a: buy 2 → one application (third unit can't form another pair)
    const result = matchRule(cart(line({ productId: "a", unitAmountCents: 1000, qty: 3 })), {
      buy: { requirements: [{ refs: [{ kind: "product", id: "a" }], qty: 2 }] },
      effect: { kind: "freeUnits", count: 1, target: "buy" },
    });
    expect(result.applications).toHaveLength(1);
  });

  it("matches by variant and by category", () => {
    const c = cart(
      line({ productId: "a", variantId: "v-large", categoryIds: ["teas"], unitAmountCents: 4000 }),
      line({ productId: "b", categoryIds: ["snacks"], unitAmountCents: 2000 }),
    );
    expect(
      matchRule(c, {
        buy: { requirements: [{ refs: [{ kind: "variant", id: "v-large" }], qty: 1 }] },
        effect: { kind: "percentOff", percent: 10, target: "buy" },
      }).applications,
    ).toHaveLength(1);
    expect(
      matchRule(c, {
        buy: { requirements: [{ refs: [{ kind: "category", id: "snacks" }], qty: 1 }] },
        effect: { kind: "percentOff", percent: 10, target: "buy" },
      }).applications,
    ).toHaveLength(1);
  });

  it("matches modifier units at their price delta, and wildcard skips them", () => {
    const c = cart(
      line({
        productId: "a",
        unitAmountCents: 4000,
        modifierOptions: [{ id: "top", priceDeltaCents: 500 }],
      }),
    );
    const modMatch = matchRule(c, {
      buy: { requirements: [{ refs: [{ kind: "modifierOption", id: "top" }], qty: 1 }] },
      effect: { kind: "percentOff", percent: 100, target: "buy" },
    });
    expect(modMatch.applications[0]?.buyUnits[0]).toMatchObject({
      source: "modifierOption",
      amountCents: 500,
    });
    const wildcard = matchRule(c, {
      buy: { requirements: [{ refs: [], qty: 2 }] },
      effect: { kind: "freeUnits", count: 1, target: "buy" },
    });
    expect(wildcard.applications).toHaveLength(0); // only ONE product unit
  });

  it("fills the get side from remaining units and reports missing get-side", () => {
    const withGet = matchRule(
      cart(line({ productId: "mouse", unitAmountCents: 8000 }), line({ productId: "pad", unitAmountCents: 2000 })),
      {
        buy: { requirements: [{ refs: [{ kind: "product", id: "mouse" }], qty: 1 }] },
        get: { requirements: [{ refs: [{ kind: "product", id: "pad" }], qty: 1 }] },
        effect: { kind: "percentOff", percent: 50, target: "get" },
      },
    );
    expect(withGet.applications).toHaveLength(1);
    expect(withGet.applications[0]?.getUnits[0]?.amountCents).toBe(2000);

    const missing = matchRule(cart(line({ productId: "mouse", unitAmountCents: 8000 })), {
      buy: { requirements: [{ refs: [{ kind: "product", id: "mouse" }], qty: 1 }] },
      get: { requirements: [{ refs: [{ kind: "product", id: "pad" }], qty: 1 }] },
      effect: { kind: "percentOff", percent: 50, target: "get" },
    });
    expect(missing.applications).toHaveLength(0);
    expect(missing.missingGetSide).toEqual([{ kind: "product", id: "pad" }]);
  });

  it("applies a zero-consumption rule exactly once", () => {
    const result = matchRule(cart(line({ productId: "a", unitAmountCents: 1000 })), {
      buy: { requirements: [] },
      effect: { kind: "percentOff", percent: 10, target: "order" },
    });
    expect(result.applications).toHaveLength(1);
  });
});
