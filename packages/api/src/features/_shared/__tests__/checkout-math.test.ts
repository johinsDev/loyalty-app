import { describe, expect, it } from "vitest";

import { resolveNet, type NetInput, type StackingPolicy } from "../checkout-math";

const OPEN: StackingPolicy = {
  tierStacksWithPromo: true,
  rewardStacksWithPromo: true,
  maxTotalDiscountPct: 100,
};
const base: NetInput = {
  subtotalCents: 20000,
  rewardDiscountCents: 0,
  promoDiscountCents: 0,
  promoExclusive: false,
  tierDiscountPct: 0,
};

describe("resolveNet", () => {
  it("no discounts → net = subtotal", () => {
    expect(resolveNet(base, OPEN).netPriceCents).toBe(20000);
  });

  it("full stack reward→promo→tier on the running remainder", () => {
    // 20000 −5000(reward)=15000 −3000(promo)=12000 −10%(tier)=1200 → 10800
    const r = resolveNet(
      { ...base, rewardDiscountCents: 5000, promoDiscountCents: 3000, tierDiscountPct: 10 },
      OPEN,
    );
    expect(r).toMatchObject({
      rewardDiscountCents: 5000,
      promoDiscountCents: 3000,
      tierDiscountCents: 1200,
      totalDiscountCents: 9200,
      netPriceCents: 10800,
      capApplied: false,
    });
  });

  it("tier % is floored", () => {
    // remainder 12333 * 10% = 1233.3 → 1233
    const r = resolveNet({ ...base, subtotalCents: 12333, tierDiscountPct: 10 }, OPEN);
    expect(r.tierDiscountCents).toBe(1233);
    expect(r.netPriceCents).toBe(11100);
  });

  it("exclusive promo suppresses reward + tier", () => {
    const r = resolveNet(
      {
        ...base,
        rewardDiscountCents: 5000,
        promoDiscountCents: 3000,
        tierDiscountPct: 10,
        promoExclusive: true,
      },
      OPEN,
    );
    expect(r).toMatchObject({
      rewardDiscountCents: 0,
      promoDiscountCents: 3000,
      tierDiscountCents: 0,
      netPriceCents: 17000,
      suppressed: { reward: true, promo: false, tier: true },
    });
  });

  it("rewardStacksWithPromo=false drops the promo (reward wins)", () => {
    const r = resolveNet(
      { ...base, rewardDiscountCents: 5000, promoDiscountCents: 3000, tierDiscountPct: 10 },
      { ...OPEN, rewardStacksWithPromo: false },
    );
    // reward 5000 → 15000, promo dropped, tier 10% of 15000 = 1500 → 13500
    expect(r).toMatchObject({
      rewardDiscountCents: 5000,
      promoDiscountCents: 0,
      tierDiscountCents: 1500,
      netPriceCents: 13500,
      suppressed: { reward: false, promo: true, tier: false },
    });
  });

  it("tierStacksWithPromo=false drops the tier when a promo applies", () => {
    const r = resolveNet(
      { ...base, promoDiscountCents: 3000, tierDiscountPct: 10 },
      { ...OPEN, tierStacksWithPromo: false },
    );
    expect(r).toMatchObject({
      promoDiscountCents: 3000,
      tierDiscountCents: 0,
      netPriceCents: 17000,
      suppressed: { promo: false, tier: true },
    });
  });

  it("tier still applies when there's no promo even if tierStacksWithPromo=false", () => {
    const r = resolveNet(
      { ...base, tierDiscountPct: 10 },
      { ...OPEN, tierStacksWithPromo: false },
    );
    expect(r.tierDiscountCents).toBe(2000);
    expect(r.netPriceCents).toBe(18000);
  });

  it("cap eats tier first, then promo, then reward", () => {
    // raw: reward 5000 + promo 3000 + tier 1200 = 9200; cap 30% of 20000 = 6000
    const r = resolveNet(
      { ...base, rewardDiscountCents: 5000, promoDiscountCents: 3000, tierDiscountPct: 10 },
      { ...OPEN, maxTotalDiscountPct: 30 },
    );
    // excess 3200: tier 1200→0, promo 3000→1000, reward 5000 intact
    expect(r).toMatchObject({
      rewardDiscountCents: 5000,
      promoDiscountCents: 1000,
      tierDiscountCents: 0,
      totalDiscountCents: 6000,
      netPriceCents: 14000,
      capApplied: true,
    });
  });

  it("cap can bite into the reward when it alone exceeds the cap", () => {
    const r = resolveNet(
      { ...base, rewardDiscountCents: 8000 },
      { ...OPEN, maxTotalDiscountPct: 30 },
    );
    // cap 6000; reward 8000 → 6000
    expect(r).toMatchObject({ rewardDiscountCents: 6000, totalDiscountCents: 6000, capApplied: true });
  });

  it("discount can't exceed subtotal", () => {
    const r = resolveNet({ ...base, subtotalCents: 4000, rewardDiscountCents: 5000 }, OPEN);
    expect(r.rewardDiscountCents).toBe(4000);
    expect(r.netPriceCents).toBe(0);
  });

  it("maxTotalDiscountPct=100 → no cap", () => {
    const r = resolveNet(
      { ...base, rewardDiscountCents: 5000, promoDiscountCents: 3000, tierDiscountPct: 10 },
      OPEN,
    );
    expect(r.capApplied).toBe(false);
  });
});
