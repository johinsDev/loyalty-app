import { describe, expect, it } from "vitest";

import { tierFor, tierRank } from "../tier-calc";

// Config TIERS: hoja(0) · flor(600) · oro(1200), NEAR_THRESHOLD_PCT=0.8.

describe("tierFor", () => {
  it("base tier at 0 points, next = flor", () => {
    const v = tierFor(0);
    expect(v.current.key).toBe("hoja");
    expect(v.next?.key).toBe("flor");
    expect(v.progress).toBe(0);
    expect(v.remainingToNext).toBe(600);
    expect(v.nearNext).toBe(false);
  });

  it("exactly at a threshold promotes to that tier", () => {
    const v = tierFor(600);
    expect(v.current.key).toBe("flor");
    expect(v.next?.key).toBe("oro");
    expect(v.remainingToNext).toBe(600);
  });

  it("flags nearNext at ≥80% toward the next tier", () => {
    const v = tierFor(1100); // (1100-600)/(1200-600) = 0.833
    expect(v.current.key).toBe("flor");
    expect(v.nearNext).toBe(true);
    expect(v.remainingToNext).toBe(100);
  });

  it("not near below 80%", () => {
    const v = tierFor(900); // 0.5
    expect(v.nearNext).toBe(false);
  });

  it("top tier has no next, full progress", () => {
    const v = tierFor(2000);
    expect(v.current.key).toBe("oro");
    expect(v.next).toBeNull();
    expect(v.progress).toBe(1);
    expect(v.nearNext).toBe(false);
  });
});

describe("tierRank", () => {
  it("ranks ascending by threshold", () => {
    expect(tierRank("hoja")).toBe(0);
    expect(tierRank("flor")).toBe(1);
    expect(tierRank("oro")).toBe(2);
  });
});
