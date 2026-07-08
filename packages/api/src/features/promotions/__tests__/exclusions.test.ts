import { describe, expect, it } from "vitest";

import {
  applyExclusions,
  evaluatePromo,
  excludedAmountCents,
  expandUnits,
  toExclusions,
} from "../engine";
import { compileRule } from "../rule-compile";
import { cart, facts, line, NOW, view } from "../__fixtures__/promos";

describe("exclusions helpers", () => {
  it("toExclusions groups units by line/source/modifier with counts", () => {
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
    const ex = toExclusions(units);
    expect(ex).toContainEqual({ lineIndex: 0, source: "product", modifierOptionId: undefined, count: 2 });
    expect(ex).toContainEqual({ lineIndex: 0, source: "modifierOption", modifierOptionId: "top", count: 2 });
  });

  it("applyExclusions removes only `count` units per group", () => {
    const units = expandUnits(cart(line({ productId: "a", unitAmountCents: 1000, qty: 3 })));
    const left = applyExclusions(units, [{ lineIndex: 0, source: "product", count: 1 }]);
    expect(left).toHaveLength(2);
  });

  it("excludedAmountCents sums product-unit line prices", () => {
    const c = cart(
      line({ productId: "a", unitAmountCents: 5000 }),
      line({ productId: "b", unitAmountCents: 3000 }),
    );
    const amt = excludedAmountCents(c, [{ lineIndex: 0, source: "product", count: 1 }]);
    expect(amt).toBe(5000);
  });
});

describe("evaluatePromo with exclusions", () => {
  it("a 2x1 no longer matches when the only pair member is reward-excluded", () => {
    const rule = compileRule({ type: "nxm", refs: [], buyQty: 2, payQty: 1 });
    const c = cart(line({ productId: "a", unitAmountCents: 4000, qty: 2 }));
    const full = evaluatePromo(c, view({ rule }), facts(), NOW);
    expect(full.eligible).toBe(true); // frees one $4000
    const withExclusion = evaluatePromo(c, view({ rule }), facts(), NOW, [
      { lineIndex: 0, source: "product", count: 1 },
    ]);
    // only 1 unit left → 2x1 can't form a pair
    expect(withExclusion.eligible).toBe(false);
  });

  it("order-wide percent discounts only the remaining subtotal", () => {
    const rule = compileRule({ type: "percentOff", refs: [], percent: 50 });
    const c = cart(
      line({ productId: "a", unitAmountCents: 10000 }),
      line({ productId: "b", unitAmountCents: 6000 }),
    );
    const reduced = evaluatePromo(c, view({ rule }), facts(), NOW, [
      { lineIndex: 0, source: "product", count: 1 },
    ]);
    // 50% of the remaining $6000, not the full $16000
    expect(reduced.discountCents).toBe(3000);
  });
});
