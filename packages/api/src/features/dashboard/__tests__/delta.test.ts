import { describe, expect, it } from "vitest";

import { computeDeltaPct } from "../schemas";

describe("computeDeltaPct", () => {
  it("returns null when the prior window is 0 (no baseline)", () => {
    expect(computeDeltaPct(5, 0)).toBeNull();
  });

  it("computes a rounded percentage change", () => {
    expect(computeDeltaPct(120, 100)).toBe(20);
    expect(computeDeltaPct(80, 100)).toBe(-20);
    expect(computeDeltaPct(133, 100)).toBe(33);
  });

  it("is 0 when unchanged", () => {
    expect(computeDeltaPct(100, 100)).toBe(0);
  });
});
