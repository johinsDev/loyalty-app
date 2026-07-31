import { describe, expect, it } from "vitest";

import type { Cart, CartLine } from "../../promotions/engine";
import { applyUpgrade, pickUpgrade } from "../variant-swap";

const line = (over: Partial<CartLine> & Pick<CartLine, "productId">): CartLine => ({
  qty: 1,
  unitAmountCents: 13_500,
  ...over,
});
const cart = (...lines: CartLine[]): Cart => ({ currency: "COP", lines });

const to = (variantId: string, deltaCents: number) => ({ variantId, deltaCents });

describe("pickUpgrade", () => {
  it("picks the biggest delta", () => {
    const c = cart(
      line({ productId: "a", upgradeTo: to("a_gra", 2_000) }),
      line({ productId: "b", upgradeTo: to("b_gra", 3_500) }),
      line({ productId: "c", upgradeTo: to("c_gra", 1_000) }),
    );
    expect(pickUpgrade(c)).toEqual({ lineIndex: 1, toVariantId: "b_gra", deltaCents: 3_500 });
  });

  // Determinism matters: preview and recordPurchase run this independently and
  // must land on the same unit.
  it("breaks ties on the lowest line index", () => {
    const c = cart(
      line({ productId: "a", upgradeTo: to("a_gra", 2_000) }),
      line({ productId: "b", upgradeTo: to("b_gra", 2_000) }),
    );
    expect(pickUpgrade(c)!.lineIndex).toBe(0);
  });

  it("ignores lines with no target or a non-positive delta", () => {
    expect(pickUpgrade(cart(line({ productId: "a" })))).toBeNull();
    expect(pickUpgrade(cart(line({ productId: "a", upgradeTo: null })))).toBeNull();
    expect(pickUpgrade(cart(line({ productId: "a", upgradeTo: to("x", 0) })))).toBeNull();
  });
});

describe("applyUpgrade", () => {
  it("replaces the line in place when qty is 1", () => {
    const c = cart(
      line({ productId: "a", variantId: "a_med", upgradeTo: to("a_gra", 2_000) }),
    );
    const r = applyUpgrade(c, pickUpgrade(c)!);
    expect(r.cart.lines).toHaveLength(1);
    expect(r.cart.lines[0]).toMatchObject({
      variantId: "a_gra",
      qty: 1,
      unitAmountCents: 15_500,
    });
    expect(r.upgradedIndex).toBe(0);
  });

  // The money bug: without the split, one delta comes off while all three units
  // are served as the bigger size.
  it("splits a qty-3 line into 2 + 1", () => {
    const c = cart(
      line({ productId: "a", variantId: "a_med", qty: 3, upgradeTo: to("a_gra", 2_000) }),
      line({ productId: "z", variantId: "z", unitAmountCents: 9_000 }),
    );
    const r = applyUpgrade(c, pickUpgrade(c)!);
    expect(r.cart.lines).toHaveLength(3);
    expect(r.cart.lines[0]).toMatchObject({ variantId: "a_med", qty: 2, unitAmountCents: 13_500 });
    expect(r.cart.lines[1]).toMatchObject({ variantId: "a_gra", qty: 1, unitAmountCents: 15_500 });
    // The upgraded unit is inserted after its origin, so the rest keeps its order.
    expect(r.cart.lines[2]).toMatchObject({ productId: "z" });
    expect(r.upgradedIndex).toBe(1);
  });

  // Toppings ride inside unitAmountCents; recomputing from the catalog price
  // would drop them from the charge.
  it("carries modifier and add-on deltas across the swap", () => {
    const c = cart(
      line({
        productId: "a",
        variantId: "a_med",
        unitAmountCents: 21_000, // 19.000 base + 2.000 of toppings
        upgradeTo: to("a_gra", 2_000),
      }),
    );
    const r = applyUpgrade(c, pickUpgrade(c)!);
    expect(r.cart.lines[0]!.unitAmountCents).toBe(23_000);
  });

  it("keeps the line's note, add-ons and removed ingredients on both halves", () => {
    const c = cart(
      line({
        productId: "a",
        variantId: "a_med",
        qty: 2,
        note: "sin hielo",
        addonIds: ["boba"],
        removedIngredientIds: ["azucar"],
        categoryIds: ["general"],
        upgradeTo: to("a_gra", 2_000),
      } as Partial<CartLine> & Pick<CartLine, "productId">),
    );
    const r = applyUpgrade(c, pickUpgrade(c)!);
    for (const l of r.cart.lines) {
      expect(l).toMatchObject({
        note: "sin hielo",
        addonIds: ["boba"],
        removedIngredientIds: ["azucar"],
        categoryIds: ["general"],
      });
    }
  });

  it("excludes exactly the upgraded unit from the promo remainder", () => {
    const c = cart(
      line({ productId: "a", variantId: "a_med", qty: 3, upgradeTo: to("a_gra", 2_000) }),
    );
    const r = applyUpgrade(c, pickUpgrade(c)!);
    expect(r.exclusions).toEqual([{ lineIndex: 1, source: "product", count: 1 }]);
  });

  it("clears the target so the same line can't be upgraded twice", () => {
    const c = cart(
      line({ productId: "a", variantId: "a_med", upgradeTo: to("a_gra", 2_000) }),
    );
    const r = applyUpgrade(c, pickUpgrade(c)!);
    expect(pickUpgrade(r.cart)).toBeNull();
  });

  // The whole point of the feature, as an equation: the subtotal grows by
  // exactly the delta, and the reward discounts exactly the delta — so the
  // customer pays what the Mediano cost while receiving the Grande.
  it.each([1, 2, 5])("nets out to the original subtotal at qty %i", (qty) => {
    const c = cart(
      line({ productId: "a", variantId: "a_med", qty, upgradeTo: to("a_gra", 2_000) }),
      line({ productId: "z", variantId: "z", qty: 2, unitAmountCents: 9_000 }),
    );
    const sum = (k: Cart) => k.lines.reduce((s, l) => s + l.unitAmountCents * l.qty, 0);
    const plan = pickUpgrade(c)!;
    const r = applyUpgrade(c, plan);
    expect(sum(r.cart) - plan.deltaCents).toBe(sum(c));
  });

  it("leaves the input cart untouched", () => {
    const c = cart(
      line({ productId: "a", variantId: "a_med", qty: 2, upgradeTo: to("a_gra", 2_000) }),
    );
    applyUpgrade(c, pickUpgrade(c)!);
    expect(c.lines).toHaveLength(1);
    expect(c.lines[0]).toMatchObject({ variantId: "a_med", qty: 2 });
  });
});
