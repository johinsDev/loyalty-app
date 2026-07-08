import { describe, expect, it } from "vitest";

import { partitionById } from "../diff";

describe("partitionById (product upsert id-stability)", () => {
  it("ids present in both survive (update), never deleted", () => {
    // A variant `v1` and modifier-option `m1` are referenced by a promo rule.
    const { toDelete, toUpdate, toInsert } = partitionById(
      ["v1", "m1", "old"],
      ["v1", "m1", "new"],
    );
    expect(toDelete).toEqual(["old"]);
    expect(toUpdate).toEqual(["v1", "m1"]); // referenced ids preserved in place
    expect(toInsert).toEqual(["new"]);
  });

  it("first upsert (no existing rows) inserts all, deletes none", () => {
    const r = partitionById([], ["a", "b"]);
    expect(r.toDelete).toEqual([]);
    expect(r.toInsert).toEqual(["a", "b"]);
    expect(r.toUpdate).toEqual([]);
  });

  it("clearing a collection deletes every existing row", () => {
    const r = partitionById(["a", "b"], []);
    expect(r.toDelete).toEqual(["a", "b"]);
    expect(r.toInsert).toEqual([]);
  });

  it("no-op edit keeps all ids as updates, none deleted/inserted", () => {
    const r = partitionById(["a", "b", "c"], ["a", "b", "c"]);
    expect(r.toDelete).toEqual([]);
    expect(r.toInsert).toEqual([]);
    expect(r.toUpdate).toEqual(["a", "b", "c"]);
  });
});
