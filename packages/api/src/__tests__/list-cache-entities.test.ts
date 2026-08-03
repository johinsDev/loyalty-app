import { describe, expect, it } from "vitest";

import { LIST_CACHED_ENTITIES } from "../features/_shared/list-cache";
import { appRouter } from "../routers/_app";

/**
 * `bustListsOnMutation` derives the entity from the tRPC path
 * (`path.split(".")[0]`), so a cached entity whose name isn't a real router
 * segment can never be busted: reads keep serving the pre-mutation rows until
 * the TTL expires. That is exactly how archiving a promo left the list showing
 * "publicada" — the cache said "promotions", the router segment is
 * "promociones", and the two never met.
 *
 * The mismatch is invisible at runtime (no error, just stale data), so it gets
 * asserted here instead.
 */
describe("LIST_CACHED_ENTITIES", () => {
  it("only names real top-level router segments", () => {
    const segments = new Set(Object.keys(appRouter._def.procedures ?? {}).map((p) => p.split(".")[0]));
    const orphans = [...LIST_CACHED_ENTITIES].filter((e) => !segments.has(e));
    expect(orphans).toEqual([]);
  });
});
