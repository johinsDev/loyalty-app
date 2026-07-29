import { CacheManager } from "@loyalty/cache";
import { describe, expect, it, vi } from "vitest";

import { cachedRead, ROLE_TTL_SECONDS, roleCacheKey } from "../trpc";

const store = () =>
  new CacheManager({
    default: "memory",
    stores: { memory: { provider: "memory" } },
  }).use();

describe("roleCacheKey", () => {
  it("is stable per user, so auth.me and enforceRole share one entry", () => {
    expect(roleCacheKey("u_1")).toBe("role:u_1");
    expect(roleCacheKey("u_1")).toBe(roleCacheKey("u_1"));
    expect(roleCacheKey("u_1")).not.toBe(roleCacheKey("u_2"));
  });
});

describe("role caching", () => {
  it("spares the DB lookup on repeat gate checks", async () => {
    const cache = store();
    const lookup = vi.fn(async () => "manager");

    await cachedRead({ cache }, roleCacheKey("u_1"), ROLE_TTL_SECONDS, lookup);
    await cachedRead({ cache }, roleCacheKey("u_1"), ROLE_TTL_SECONDS, lookup);

    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("does not leak one user's role to another", async () => {
    const cache = store();

    const owner = await cachedRead({ cache }, roleCacheKey("u_1"), ROLE_TTL_SECONDS, async () => "owner");
    const staff = await cachedRead({ cache }, roleCacheKey("u_2"), ROLE_TTL_SECONDS, async () => "staff");

    expect([owner, staff]).toEqual(["owner", "staff"]);
  });

  /**
   * The security-critical one: a demotion must take effect on the next request,
   * not after the TTL. `employees.update`/`disable`/`remove`/`bulk*` all call
   * `bustRoles`, which deletes exactly this key.
   */
  it("re-reads the role after the key is busted", async () => {
    const cache = store();
    let current = "owner";
    const lookup = vi.fn(async () => current);

    const before = await cachedRead({ cache }, roleCacheKey("u_1"), ROLE_TTL_SECONDS, lookup);
    current = "staff";
    await cache.delete(roleCacheKey("u_1"));
    const after = await cachedRead({ cache }, roleCacheKey("u_1"), ROLE_TTL_SECONDS, lookup);

    expect(before).toBe("owner");
    expect(after).toBe("staff");
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("would otherwise serve the stale role — proving the bust is load-bearing", async () => {
    const cache = store();
    let current = "owner";
    const lookup = async () => current;

    await cachedRead({ cache }, roleCacheKey("u_1"), ROLE_TTL_SECONDS, lookup);
    current = "staff";
    const withoutBust = await cachedRead({ cache }, roleCacheKey("u_1"), ROLE_TTL_SECONDS, lookup);

    expect(withoutBust).toBe("owner");
  });
});
