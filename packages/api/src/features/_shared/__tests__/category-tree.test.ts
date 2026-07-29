import { describe, expect, it } from "vitest";

import {
  idsForSlug,
  withAncestors,
  withDescendants,
  type CategoryAncestry,
} from "../category-tree";

/**
 * Milk Tea ─┬ Clasicos
 *           └ Premium
 * Matcha (leaf root)
 */
const ancestry: CategoryAncestry = {
  parentOf: new Map([
    ["milk", null],
    ["clasicos", "milk"],
    ["premium", "milk"],
    ["matcha", null],
  ]),
  childrenOf: new Map([["milk", ["clasicos", "premium"]]]),
  idBySlug: new Map([
    ["milk-tea", "milk"],
    ["clasicos", "clasicos"],
    ["premium", "premium"],
    ["matcha", "matcha"],
  ]),
};

describe("withDescendants (filtering by a category)", () => {
  it("expands a grouping category into its children — products live on leaves", () => {
    expect(withDescendants(ancestry, ["milk"]).sort()).toEqual(["clasicos", "milk", "premium"]);
  });

  it("leaves a leaf alone", () => {
    expect(withDescendants(ancestry, ["premium"])).toEqual(["premium"]);
  });

  it("expands a root with no children to just itself", () => {
    expect(withDescendants(ancestry, ["matcha"])).toEqual(["matcha"]);
  });

  it("dedupes when a parent and its child are both selected", () => {
    expect(withDescendants(ancestry, ["milk", "premium"]).sort()).toEqual([
      "clasicos",
      "milk",
      "premium",
    ]);
  });

  it("is empty for an empty selection", () => {
    expect(withDescendants(ancestry, [])).toEqual([]);
  });
});

describe("withAncestors (what a product counts for)", () => {
  it("adds the parent, so a rule written against the root still matches", () => {
    expect(withAncestors(ancestry, ["premium"]).sort()).toEqual(["milk", "premium"]);
  });

  it("adds each parent once when several leaves share it", () => {
    expect(withAncestors(ancestry, ["clasicos", "premium"]).sort()).toEqual([
      "clasicos",
      "milk",
      "premium",
    ]);
  });

  it("leaves a root untouched", () => {
    expect(withAncestors(ancestry, ["matcha"])).toEqual(["matcha"]);
  });

  it("ignores ids it has never seen (archived/deleted refs)", () => {
    expect(withAncestors(ancestry, ["ghost"])).toEqual(["ghost"]);
  });
});

describe("idsForSlug (customer menu filter)", () => {
  it("resolves a root slug to the root plus its leaves", () => {
    expect(idsForSlug(ancestry, "milk-tea").sort()).toEqual(["clasicos", "milk", "premium"]);
  });

  it("resolves a leaf slug to just that leaf", () => {
    expect(idsForSlug(ancestry, "premium")).toEqual(["premium"]);
  });

  it("returns nothing for an unknown slug, so the caller shows an empty list", () => {
    expect(idsForSlug(ancestry, "no-such-category")).toEqual([]);
  });
});
