import { CacheManager } from "@loyalty/cache";
import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

import { cachedRead, orgId, requireOrg } from "../trpc";

describe("orgId", () => {
  it("returns the resolved org", () => {
    expect(orgId({ organizationId: "org_1" })).toBe("org_1");
  });

  it("falls back to an empty string on a DB with no org yet", () => {
    expect(orgId({ organizationId: null })).toBe("");
  });
});

describe("requireOrg", () => {
  it("returns the resolved org", () => {
    expect(requireOrg({ organizationId: "org_1" })).toBe("org_1");
  });

  it("throws PRECONDITION_FAILED when no org is provisioned", () => {
    expect(() => requireOrg({ organizationId: null })).toThrow(TRPCError);
    expect(() => requireOrg({ organizationId: null })).toThrow("No active organization");
  });
});

/**
 * The org id is the first organization ever created, so it never changes —
 * these lock in that a bound cache actually spares the DB round trip that used
 * to run at the head of nearly every resolver.
 */
describe("primary-org caching", () => {
  const store = () =>
    new CacheManager({
      default: "memory",
      stores: { memory: { provider: "memory" } },
    }).use();

  it("queries the DB once and serves later requests from cache", async () => {
    const cache = store();
    const lookup = vi.fn(async () => "org_1");

    const first = await cachedRead({ cache }, "org:primary", 3600, lookup);
    const second = await cachedRead({ cache }, "org:primary", 3600, lookup);

    expect([first, second]).toEqual(["org_1", "org_1"]);
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("never caches a null org, so a fresh DB retries until one is seeded", async () => {
    const cache = store();
    const lookup = vi.fn(async () => null);

    await cachedRead({ cache }, "org:primary", 3600, lookup);
    await cachedRead({ cache }, "org:primary", 3600, lookup);

    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("falls through to the DB when no cache is bound (CLI/tests)", async () => {
    const lookup = vi.fn(async () => "org_1");

    await cachedRead({}, "org:primary", 3600, lookup);
    await cachedRead({}, "org:primary", 3600, lookup);

    expect(lookup).toHaveBeenCalledTimes(2);
  });
});
