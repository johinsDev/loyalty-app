import { describe, expect, it } from "vitest";

import {
  axisSummaries,
  pairOutcomes,
  upgradeTargets,
  type VariantNode,
} from "../variant-graph";

const node = (
  variantId: string,
  productId: string,
  priceCents: number,
  options: Record<string, string>,
): VariantNode => ({
  variantId,
  productId,
  priceCents,
  options: new Map(Object.entries(options)),
});

/** Mirrors the real catalog: one axis "Tamaño", Mediano/Grande, +$2.000. */
const TEA = [
  node("classic_med", "classic", 13_500, { Tamaño: "Mediano" }),
  node("classic_gra", "classic", 15_500, { Tamaño: "Grande" }),
  node("taro_med", "taro", 15_500, { Tamaño: "Mediano" }),
  node("taro_gra", "taro", 17_500, { Tamaño: "Grande" }),
];

describe("upgradeTargets", () => {
  it("maps each source variant to its pricier sibling", () => {
    const t = upgradeTargets(TEA, "Tamaño", "Mediano", "Grande");
    expect(t.get("classic_med")).toEqual({ variantId: "classic_gra", deltaCents: 2_000 });
    expect(t.get("taro_med")).toEqual({ variantId: "taro_gra", deltaCents: 2_000 });
  });

  // The semantic flip: the map is keyed by the variant the customer HAS, not by
  // the one they're upgrading to.
  it("does not key the target variant", () => {
    const t = upgradeTargets(TEA, "Tamaño", "Mediano", "Grande");
    expect(t.has("classic_gra")).toBe(false);
  });

  it("keeps products independent even when they share label spellings", () => {
    const t = upgradeTargets(TEA, "Tamaño", "Mediano", "Grande");
    expect(t.get("classic_med")!.variantId).toBe("classic_gra");
    expect(t.get("taro_med")!.variantId).toBe("taro_gra");
  });

  // The sibling has to agree on every OTHER axis, or a Mediano/Deslactosada
  // would "upgrade" into a Grande/Entera and the customer gets the wrong drink.
  it("requires every other axis to match", () => {
    const multi = [
      node("a", "p", 10_000, { Tamaño: "Mediano", Leche: "Entera" }),
      node("b", "p", 12_000, { Tamaño: "Grande", Leche: "Entera" }),
      node("c", "p", 11_000, { Tamaño: "Mediano", Leche: "Deslactosada" }),
      node("d", "p", 13_000, { Tamaño: "Grande", Leche: "Deslactosada" }),
    ];
    const t = upgradeTargets(multi, "Tamaño", "Mediano", "Grande");
    expect(t.get("a")).toEqual({ variantId: "b", deltaCents: 2_000 });
    expect(t.get("c")).toEqual({ variantId: "d", deltaCents: 2_000 });
  });

  it("skips a source whose target sibling doesn't exist", () => {
    const t = upgradeTargets(
      [node("only_med", "p", 10_000, { Tamaño: "Mediano" })],
      "Tamaño",
      "Mediano",
      "Grande",
    );
    expect(t.size).toBe(0);
  });

  it.each([
    ["cheaper", 9_000],
    ["equal", 10_000],
  ])("skips a target that is %s than the source", (_label, targetPrice) => {
    const t = upgradeTargets(
      [
        node("med", "p", 10_000, { Tamaño: "Mediano" }),
        node("gra", "p", targetPrice, { Tamaño: "Grande" }),
      ],
      "Tamaño",
      "Mediano",
      "Grande",
    );
    expect(t.size).toBe(0);
  });

  it("ignores a product with no options at all (4 of 11 in the real catalog)", () => {
    const t = upgradeTargets([node("solo", "p", 16_000, {})], "Tamaño", "Mediano", "Grande");
    expect(t.size).toBe(0);
  });

  it("matches labels exactly — a different spelling is simply not covered", () => {
    const t = upgradeTargets(
      [
        node("med", "p", 10_000, { Size: "Medium" }),
        node("gra", "p", 12_000, { Size: "Large" }),
      ],
      "Tamaño",
      "Mediano",
      "Grande",
    );
    expect(t.size).toBe(0);
  });

  it("returns nothing when from and to are the same value", () => {
    expect(upgradeTargets(TEA, "Tamaño", "Grande", "Grande").size).toBe(0);
  });
});

describe("axisSummaries", () => {
  it("reports n-of-m coverage and names the products missing the axis", () => {
    // Frutales in the real catalog: 1 of 4 products has variants.
    const nodes = [
      node("m_med", "matcha", 17_000, { Tamaño: "Mediano" }),
      node("m_gra", "matcha", 19_000, { Tamaño: "Grande" }),
    ];
    const [axis] = axisSummaries(nodes, ["matcha", "mango", "peach", "fresa"]);
    expect(axis!.optionName).toBe("Tamaño");
    expect(axis!.coveredCount).toBe(1);
    expect(axis!.missingProductIds).toEqual(["mango", "peach", "fresa"]);
  });

  it("counts how many products carry each value", () => {
    const [axis] = axisSummaries(TEA, ["classic", "taro"]);
    expect(axis!.values).toEqual([
      { label: "Grande", productCount: 2 },
      { label: "Mediano", productCount: 2 },
    ]);
  });

  it("orders axes by coverage so the most useful one comes first", () => {
    const nodes = [
      node("a", "p1", 10_000, { Tamaño: "Mediano", Leche: "Entera" }),
      node("b", "p2", 10_000, { Tamaño: "Mediano" }),
    ];
    expect(axisSummaries(nodes, ["p1", "p2"]).map((a) => a.optionName)).toEqual([
      "Tamaño",
      "Leche",
    ]);
  });

  it("returns nothing when no product in scope has variants", () => {
    expect(axisSummaries([], ["a", "b"])).toEqual([]);
  });
});

describe("pairOutcomes", () => {
  it("gives the delta per product", () => {
    const out = pairOutcomes(TEA, ["classic", "taro"], "Tamaño", "Mediano", "Grande");
    expect(out).toEqual([
      { productId: "classic", deltaCents: 2_000, reason: null },
      { productId: "taro", deltaCents: 2_000, reason: null },
    ]);
  });

  it.each([
    ["no-axis", [node("x", "p", 10_000, {})]],
    ["no-from", [node("x", "p", 10_000, { Tamaño: "Grande" })]],
    ["no-to", [node("x", "p", 10_000, { Tamaño: "Mediano" })]],
    [
      "not-pricier",
      [
        node("x", "p", 10_000, { Tamaño: "Mediano" }),
        node("y", "p", 9_000, { Tamaño: "Grande" }),
      ],
    ],
  ])("explains a product that doesn't qualify as %s", (reason, nodes) => {
    const [out] = pairOutcomes(nodes as VariantNode[], ["p"], "Tamaño", "Mediano", "Grande");
    expect(out).toEqual({ productId: "p", deltaCents: null, reason });
  });

  it("takes the biggest delta when a product has several qualifying pairs", () => {
    const nodes = [
      node("a", "p", 10_000, { Tamaño: "Mediano", Leche: "Entera" }),
      node("b", "p", 12_000, { Tamaño: "Grande", Leche: "Entera" }),
      node("c", "p", 11_000, { Tamaño: "Mediano", Leche: "Deslactosada" }),
      node("d", "p", 16_000, { Tamaño: "Grande", Leche: "Deslactosada" }),
    ];
    const [out] = pairOutcomes(nodes, ["p"], "Tamaño", "Mediano", "Grande");
    expect(out!.deltaCents).toBe(5_000);
  });
});
