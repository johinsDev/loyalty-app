import { describe, expect, it } from "vitest";

import { __treeInternals } from "../repository";
import type { CategoryTreeInput, CategoryTreeNode } from "../schemas";

const { applyFilters, rollUp, setShare, marginOf } = __treeInternals;

const node = (over: Partial<CategoryTreeNode> & { id: string; name: string }): CategoryTreeNode => ({
  slug: over.name.toLowerCase(),
  description: null,
  parentId: null,
  sortOrder: 0,
  archivedAt: null,
  archivedByParent: false,
  isLeaf: true,
  children: [],
  productCount: 0,
  revenueCents: 0,
  units: 0,
  marginPct: null,
  sharePct: 0,
  ...over,
});

const input = (over: Partial<CategoryTreeInput> = {}): CategoryTreeInput => ({
  status: "active",
  period: "30d",
  metrics: true,
  storeId: null,
  ...over,
});

describe("marginOf", () => {
  it("is null when nothing was sold", () => {
    expect(marginOf({ revenueCents: 0, units: 0, cogsCents: 0 })).toBeNull();
  });

  it("is null when no recipe cost is known — not a flattering 100%", () => {
    expect(marginOf({ revenueCents: 10_000, units: 2, cogsCents: 0 })).toBeNull();
  });

  it("computes gross margin to one decimal", () => {
    expect(marginOf({ revenueCents: 10_000, units: 2, cogsCents: 2_500 })).toBe(75);
    expect(marginOf({ revenueCents: 3_000, units: 1, cogsCents: 1_000 })).toBe(66.7);
  });
});

describe("rollUp", () => {
  it("adds every descendant's figures into the parent", () => {
    const parent = node({
      id: "root",
      name: "Milk Tea",
      isLeaf: false,
      productCount: 0,
      children: [
        node({ id: "a", name: "Clasicos", parentId: "root", sortOrder: 0, productCount: 7 }),
        node({ id: "b", name: "Premium", parentId: "root", sortOrder: 1, productCount: 5 }),
      ],
    });
    const sales = new Map([
      ["a", { revenueCents: 700_000, units: 70, cogsCents: 200_000 }],
      ["b", { revenueCents: 500_000, units: 25, cogsCents: 100_000 }],
    ]);

    rollUp(parent, sales);

    expect(parent.productCount).toBe(12);
    expect(parent.revenueCents).toBe(1_200_000);
    expect(parent.units).toBe(95);
    // 1.2M revenue, 300k cost → 75%. NOT the average of 71.4% and 80%.
    expect(parent.marginPct).toBe(75);
    expect(parent.children[0]!.revenueCents).toBe(700_000);
  });

  it("keeps a parent's own sales when it also has children", () => {
    const parent = node({
      id: "root",
      name: "Postres",
      isLeaf: false,
      productCount: 1,
      children: [node({ id: "kid", name: "Tortas", parentId: "root", productCount: 2 })],
    });
    const sales = new Map([
      ["root", { revenueCents: 100, units: 1, cogsCents: 40 }],
      ["kid", { revenueCents: 300, units: 3, cogsCents: 60 }],
    ]);

    rollUp(parent, sales);

    expect(parent.revenueCents).toBe(400);
    expect(parent.productCount).toBe(3);
  });

  it("orders children by sortOrder, then name", () => {
    const parent = node({
      id: "root",
      name: "Root",
      isLeaf: false,
      children: [
        node({ id: "c", name: "Zeta", sortOrder: 1 }),
        node({ id: "a", name: "Alfa", sortOrder: 0 }),
        node({ id: "b", name: "Beta", sortOrder: 0 }),
      ],
    });
    rollUp(parent, new Map());
    expect(parent.children.map((c) => c.name)).toEqual(["Alfa", "Beta", "Zeta"]);
  });
});

describe("setShare", () => {
  it("splits the window's revenue across roots, summing to 100%", () => {
    const roots = [
      node({ id: "a", name: "A", revenueCents: 750 }),
      node({ id: "b", name: "B", revenueCents: 250 }),
    ];
    const total = 1000;
    for (const r of roots) setShare(r, total);
    expect(roots.map((r) => r.sharePct)).toEqual([75, 25]);
  });

  it("is 0 for everything when nothing was sold (no divide-by-zero)", () => {
    const root = node({ id: "a", name: "A", children: [node({ id: "b", name: "B" })] });
    setShare(root, 0);
    expect(root.sharePct).toBe(0);
    expect(root.children[0]!.sharePct).toBe(0);
  });
});

describe("applyFilters", () => {
  const tree = () => [
    node({
      id: "root",
      name: "Milk Tea",
      isLeaf: false,
      children: [
        node({ id: "kid", name: "Premium", parentId: "root" }),
        node({
          id: "gone",
          name: "Descontinuados",
          parentId: "root",
          archivedAt: new Date("2026-01-01"),
          archivedByParent: true,
        }),
      ],
    }),
    node({ id: "matcha", name: "Matcha" }),
    node({ id: "old", name: "Temporada", archivedAt: new Date("2026-01-01") }),
  ];

  it("hides archived categories by default", () => {
    const out = applyFilters(tree(), input());
    expect(out.map((n) => n.name)).toEqual(["Milk Tea", "Matcha"]);
    expect(out[0]!.children.map((c) => c.name)).toEqual(["Premium"]);
  });

  it("shows only archived ones when asked", () => {
    const out = applyFilters(tree(), input({ status: "archived" }));
    // "Milk Tea" survives to frame its archived child, but is not itself listed
    // as archived — its only visible child is the archived one.
    expect(out.map((n) => n.name)).toEqual(["Milk Tea", "Temporada"]);
    expect(out[0]!.children.map((c) => c.name)).toEqual(["Descontinuados"]);
  });

  it("returns everything with status=all", () => {
    const out = applyFilters(tree(), input({ status: "all" }));
    expect(out).toHaveLength(3);
    expect(out[0]!.children).toHaveLength(2);
  });

  it("keeps a matching child's parent as its group header", () => {
    const out = applyFilters(tree(), input({ search: "premium" }));
    expect(out.map((n) => n.name)).toEqual(["Milk Tea"]);
    expect(out[0]!.children.map((c) => c.name)).toEqual(["Premium"]);
  });

  it("keeps every live child when the parent itself matches", () => {
    const out = applyFilters(tree(), input({ search: "milk" }));
    expect(out[0]!.children.map((c) => c.name)).toEqual(["Premium"]);
  });

  it("matches on the description too", () => {
    const withDesc = [node({ id: "a", name: "Bebidas", description: "Tés y boba" })];
    expect(applyFilters(withDesc, input({ search: "boba" }))).toHaveLength(1);
    expect(applyFilters(withDesc, input({ search: "cheesecake" }))).toHaveLength(0);
  });

  it("is case- and accent-insensitive on the needle it was given", () => {
    const out = applyFilters(tree(), input({ search: "MATCHA" }));
    expect(out.map((n) => n.name)).toEqual(["Matcha"]);
  });
});
