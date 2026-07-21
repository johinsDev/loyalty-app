import { describe, expect, it } from "vitest";

import { ALL_STORES, resolveStoreScope } from "../store-scope";

const stores = [
  { id: "a", slug: "centro", name: "Centro" },
  { id: "b", slug: "norte", name: "Norte" },
];

describe("resolveStoreScope", () => {
  it("treats the 'all' sentinel as the aggregate view (no filter)", () => {
    expect(resolveStoreScope(stores, ALL_STORES)).toEqual({ storeId: null, store: null });
  });

  it("resolves a slug to its row (returning the real id)", () => {
    expect(resolveStoreScope(stores, "norte")).toEqual({ storeId: "b", store: stores[1] });
  });

  it("falls back to matching a raw id (slug-less rows)", () => {
    expect(resolveStoreScope(stores, "a")).toEqual({ storeId: "a", store: stores[0] });
  });

  it("returns null for an unknown segment (caller redirects to /all)", () => {
    expect(resolveStoreScope(stores, "zzz")).toBeNull();
  });

  it("returns null when the org has no stores and the segment isn't 'all'", () => {
    expect(resolveStoreScope([], "centro")).toBeNull();
  });
});
