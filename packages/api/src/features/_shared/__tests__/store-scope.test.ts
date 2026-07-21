import { describe, expect, it } from "vitest";

import { ALL_STORES, resolveStoreScope } from "../store-scope";

const stores = [
  { id: "a", name: "Centro" },
  { id: "b", name: "Norte" },
];

describe("resolveStoreScope", () => {
  it("treats the 'all' sentinel as the aggregate view (no filter)", () => {
    expect(resolveStoreScope(stores, ALL_STORES)).toEqual({ storeId: null, store: null });
  });

  it("resolves a real store id to its row", () => {
    expect(resolveStoreScope(stores, "b")).toEqual({ storeId: "b", store: stores[1] });
  });

  it("returns null for an unknown id (caller redirects to /all)", () => {
    expect(resolveStoreScope(stores, "zzz")).toBeNull();
  });

  it("returns null when the org has no stores and the segment isn't 'all'", () => {
    expect(resolveStoreScope([], "a")).toBeNull();
  });
});
