import { describe, expect, it, vi } from "vitest";

import { cachedRead } from "../trpc";

/**
 * `cachedRead` sits on the critical path of every request now: `createContext`
 * resolves the org through it and `enforceRole` resolves the role through it.
 * `CacheStore.get` does not swallow provider errors, so if this threw, an
 * Upstash blip would 500 the entire app instead of merely un-caching it.
 */
describe("cachedRead fail-open", () => {
  const exploding = (on: "get" | "set") => ({
    getOrSet: vi.fn(async (_key: string, factory: () => Promise<unknown>) => {
      if (on === "get") throw new Error("upstash unreachable");
      await factory();
      throw new Error("upstash write failed");
    }),
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  });

  it("falls back to the source when the cache read throws", async () => {
    const factory = vi.fn(async () => "org_1");

    const value = await cachedRead({ cache: exploding("get") }, "org:primary", 3600, factory);

    expect(value).toBe("org_1");
    expect(factory).toHaveBeenCalled();
  });

  it("still returns a value when the cache write throws", async () => {
    const factory = vi.fn(async () => "manager");

    const value = await cachedRead({ cache: exploding("set") }, "role:u_1", 60, factory);

    expect(value).toBe("manager");
  });

  it("warns through the bound logger so an outage isn't silent", async () => {
    const warn = vi.fn();

    await cachedRead(
      { cache: exploding("get"), log: { info: vi.fn(), warn, error: vi.fn() } },
      "org:primary",
      3600,
      async () => "org_1",
    );

    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toMatchObject({ event: "cache.error", key: "org:primary" });
  });

  it("propagates a genuine source failure — fail-open is not swallow-everything", async () => {
    const cache = exploding("get");

    await expect(
      cachedRead({ cache }, "org:primary", 3600, async () => {
        throw new Error("turso is down");
      }),
    ).rejects.toThrow("turso is down");
  });
});
