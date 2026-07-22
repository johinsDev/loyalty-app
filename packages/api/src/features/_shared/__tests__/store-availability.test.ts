import { describe, expect, it } from "vitest";

import { isAvailableAt } from "../store-availability";

describe("isAvailableAt", () => {
  it("null storeIds → available at every store", () => {
    expect(isAvailableAt(null, "s1")).toBe(true);
  });

  it("empty storeIds → available at every store", () => {
    expect(isAvailableAt([], "s1")).toBe(true);
  });

  it("matches when the store is listed", () => {
    expect(isAvailableAt(["s1", "s2"], "s2")).toBe(true);
  });

  it("excludes when the store is not listed", () => {
    expect(isAvailableAt(["s1", "s2"], "s3")).toBe(false);
  });
});
