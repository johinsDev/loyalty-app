import type { RewardRow } from "@loyalty/db/schema";
import { describe, expect, it } from "vitest";

import { deriveItem } from "../derive";
import { isAffordable, newlyReady } from "../repository";

function reward(over: Partial<RewardRow> = {}): RewardRow {
  return {
    id: "rw",
    organizationId: "org",
    name: "Reward",
    description: null,
    imageUrl: null,
    stampsRequired: null,
    pointsCost: null,
    costMode: "or",
    allowedTiers: null,
    sections: [],
    sortOrder: 0,
    limitPerCustomer: "unlimited",
    status: "published",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as RewardRow;
}

describe("isAffordable", () => {
  it("stamps-only: needs the stamps balance", () => {
    const rw = reward({ stampsRequired: 9 });
    expect(isAffordable(rw, { stamps: 8, points: 0 })).toBe(false);
    expect(isAffordable(rw, { stamps: 9, points: 0 })).toBe(true);
  });

  it("points-only: needs the points balance", () => {
    const rw = reward({ pointsCost: 120 });
    expect(isAffordable(rw, { stamps: 0, points: 100 })).toBe(false);
    expect(isAffordable(rw, { stamps: 0, points: 120 })).toBe(true);
  });

  it("OR: either currency suffices", () => {
    const rw = reward({ stampsRequired: 5, pointsCost: 50, costMode: "or" });
    expect(isAffordable(rw, { stamps: 5, points: 0 })).toBe(true);
    expect(isAffordable(rw, { stamps: 0, points: 50 })).toBe(true);
    expect(isAffordable(rw, { stamps: 4, points: 49 })).toBe(false);
  });

  it("AND: requires both currencies", () => {
    const rw = reward({ stampsRequired: 10, pointsCost: 200, costMode: "and" });
    expect(isAffordable(rw, { stamps: 10, points: 100 })).toBe(false);
    expect(isAffordable(rw, { stamps: 10, points: 200 })).toBe(true);
  });
});

describe("deriveItem status", () => {
  const base = { tierKey: "hoja", claimedCount: 0, redeemedAt: null };

  it("ready when affordable", () => {
    const it_ = deriveItem(reward({ stampsRequired: 9 }), {
      ...base,
      balances: { stamps: 9, points: 0 },
    });
    expect(it_.status).toBe("ready");
    expect(it_.affordableWith).toEqual(["stamps"]);
    expect(it_.stamps.progress).toBe(1);
  });

  it("upcoming when not affordable", () => {
    const it_ = deriveItem(reward({ stampsRequired: 9 }), {
      ...base,
      balances: { stamps: 3, points: 0 },
    });
    expect(it_.status).toBe("upcoming");
    expect(it_.stamps.progress).toBeCloseTo(3 / 9);
    expect(it_.affordableWith).toEqual([]);
  });

  it("locked when the tier is not allowed", () => {
    const it_ = deriveItem(
      reward({ pointsCost: 80, allowedTiers: ["oro"] }),
      { ...base, tierKey: "hoja", balances: { stamps: 0, points: 999 } },
    );
    // Tier gate beats affordability.
    expect(it_.status).toBe("locked");
  });

  it("redeemed when once & already claimed", () => {
    const redeemedAt = new Date();
    const it_ = deriveItem(
      reward({ stampsRequired: 1, limitPerCustomer: "once" }),
      { ...base, claimedCount: 1, redeemedAt, balances: { stamps: 9, points: 0 } },
    );
    expect(it_.status).toBe("redeemed");
    expect(it_.redeemedAt).toBe(redeemedAt);
  });

  it("AND reward is affordableWith both only when both balances cover it", () => {
    const rw = reward({ stampsRequired: 10, pointsCost: 200, costMode: "and" });
    const ready = deriveItem(rw, {
      ...base,
      balances: { stamps: 10, points: 200 },
    });
    expect(ready.status).toBe("ready");
    expect(ready.affordableWith).toEqual(["stamps", "points"]);
  });
});

describe("newlyReady", () => {
  it("returns rewards that crossed from not-ready to ready", () => {
    const a = reward({ id: "a", stampsRequired: 9 });
    const b = reward({ id: "b", pointsCost: 120 });
    const out = newlyReady(
      [a, b],
      { stamps: 8, points: 100 },
      { stamps: 9, points: 110 },
      { tierKey: "hoja", claimedRewardIds: new Set() },
    );
    expect(out.map((r) => r.id)).toEqual(["a"]);
  });

  it("ignores rewards already ready before", () => {
    const a = reward({ id: "a", stampsRequired: 9 });
    const out = newlyReady(
      [a],
      { stamps: 9, points: 0 },
      { stamps: 10, points: 0 },
      { tierKey: "hoja", claimedRewardIds: new Set() },
    );
    expect(out).toEqual([]);
  });

  it("never unlocks a tier-locked reward", () => {
    const a = reward({ id: "a", pointsCost: 80, allowedTiers: ["oro"] });
    const out = newlyReady(
      [a],
      { stamps: 0, points: 0 },
      { stamps: 0, points: 999 },
      { tierKey: "hoja", claimedRewardIds: new Set() },
    );
    expect(out).toEqual([]);
  });

  it("never re-unlocks a once reward already claimed", () => {
    const a = reward({ id: "a", stampsRequired: 1, limitPerCustomer: "once" });
    const out = newlyReady(
      [a],
      { stamps: 0, points: 0 },
      { stamps: 5, points: 0 },
      { tierKey: "hoja", claimedRewardIds: new Set(["a"]) },
    );
    expect(out).toEqual([]);
  });
});
