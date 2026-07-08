import type { RewardBenefitConfig } from "@loyalty/db/schema";
import { describe, expect, it } from "vitest";

import type { Cart, CartLine } from "../../promotions/engine";
import { evaluateRewardForCart } from "../pos-evaluate";

const line = (over: Partial<CartLine> & Pick<CartLine, "productId" | "unitAmountCents">): CartLine => ({
  qty: 1,
  ...over,
});
const cart = (...lines: CartLine[]): Cart => ({ currency: "COP", lines });
const rw = (benefit: RewardBenefitConfig | null) => ({ benefit });

describe("evaluateRewardForCart", () => {
  it("experience → $0, no exclusions", () => {
    expect(evaluateRewardForCart(rw({ type: "experience" }), cart())).toEqual({
      ok: true,
      discountCents: 0,
      exclusions: [],
    });
  });

  it("freeProduct frees the CHEAPEST matching unit", () => {
    const c = cart(
      line({ productId: "milk", categoryIds: ["teas"], unitAmountCents: 16500 }),
      line({ productId: "green", categoryIds: ["teas"], unitAmountCents: 12000 }),
    );
    const res = evaluateRewardForCart(
      rw({ type: "freeProduct", refs: [{ kind: "category", id: "teas" }] }),
      c,
    );
    expect(res).toMatchObject({ ok: true, discountCents: 12000 });
    expect((res as { exclusions: unknown[] }).exclusions).toHaveLength(1);
  });

  it("freeProduct with the item missing → reward-item-not-in-cart", () => {
    const res = evaluateRewardForCart(
      rw({ type: "freeProduct", refs: [{ kind: "product", id: "cookie" }] }),
      cart(line({ productId: "milk", unitAmountCents: 16500 })),
    );
    expect(res).toEqual({ ok: false, reason: "reward-item-not-in-cart" });
  });

  it("freeProduct on a modifier frees the topping at its delta", () => {
    const c = cart(
      line({
        productId: "milk",
        unitAmountCents: 18500,
        modifierOptions: [{ id: "tapioca", priceDeltaCents: 2000 }],
      }),
    );
    const res = evaluateRewardForCart(
      rw({ type: "freeProduct", refs: [{ kind: "modifierOption", id: "tapioca" }] }),
      c,
    );
    expect(res).toMatchObject({ ok: true, discountCents: 2000 });
  });

  it("order-wide amountOff → discount, no exclusions", () => {
    const c = cart(line({ productId: "a", unitAmountCents: 30000 }));
    const res = evaluateRewardForCart(rw({ type: "amountOff", amountCents: 5000, refs: [] }), c);
    expect(res).toEqual({ ok: true, discountCents: 5000, exclusions: [] });
  });

  it("scoped percentOff → discount over the matched unit, which is excluded", () => {
    const c = cart(
      line({ productId: "espresso", categoryIds: ["coffee"], unitAmountCents: 10000 }),
      line({ productId: "milk", unitAmountCents: 16500 }),
    );
    const res = evaluateRewardForCart(
      rw({ type: "percentOff", percent: 50, refs: [{ kind: "category", id: "coffee" }] }),
      c,
    );
    expect(res).toMatchObject({ ok: true, discountCents: 5000 });
    expect((res as { exclusions: unknown[] }).exclusions).toHaveLength(1);
  });

  it("scoped discount with no matching item → reward-item-not-in-cart", () => {
    const res = evaluateRewardForCart(
      rw({ type: "amountOff", amountCents: 5000, refs: [{ kind: "category", id: "coffee" }] }),
      cart(line({ productId: "milk", unitAmountCents: 16500 })),
    );
    expect(res).toEqual({ ok: false, reason: "reward-item-not-in-cart" });
  });
});
