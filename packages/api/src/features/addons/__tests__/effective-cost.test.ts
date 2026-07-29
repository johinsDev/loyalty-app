import { describe, expect, it } from "vitest";

import { AddonsRepository } from "../repository";

/**
 * A linked add-on's cost is derived from the recipe (`ingredientQty ×
 * costPerUnitCents`) rather than typed, so it can't drift from the ingredient.
 * A standalone add-on (car wax, nail trim) keeps its manual cost.
 */
describe("AddonsRepository.effectiveCost", () => {
  it("derives the cost from the linked ingredient", () => {
    expect(
      AddonsRepository.effectiveCost({
        costCents: 0,
        ingredientQty: 30,
        ingredientCostPerUnitCents: 50,
      }),
    ).toEqual({ costCents: 1500, costIsDerived: true });
  });

  it("rounds to whole cents", () => {
    expect(
      AddonsRepository.effectiveCost({
        costCents: 0,
        ingredientQty: 0.5,
        ingredientCostPerUnitCents: 333,
      }),
    ).toEqual({ costCents: 167, costIsDerived: true });
  });

  it("keeps the manual cost when there is no linked ingredient", () => {
    expect(
      AddonsRepository.effectiveCost({
        costCents: 900,
        ingredientQty: null,
        ingredientCostPerUnitCents: null,
      }),
    ).toEqual({ costCents: 900, costIsDerived: false });
  });

  it("falls back to the manual cost if the link lost its ingredient", () => {
    // `addon.ingredientId` is ON DELETE set null, so a qty can outlive its
    // ingredient. Deriving from a missing cost would silently report 0.
    expect(
      AddonsRepository.effectiveCost({
        costCents: 450,
        ingredientQty: 30,
        ingredientCostPerUnitCents: null,
      }),
    ).toEqual({ costCents: 450, costIsDerived: false });
  });

  it("treats a zero-cost ingredient as derived, not as missing", () => {
    expect(
      AddonsRepository.effectiveCost({
        costCents: 999,
        ingredientQty: 10,
        ingredientCostPerUnitCents: 0,
      }),
    ).toEqual({ costCents: 0, costIsDerived: true });
  });
});
