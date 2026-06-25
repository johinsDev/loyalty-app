import { describe, expect, it, vi } from "vitest";

import {
  activeClaimKey,
  cancelPendingClaim,
  CLAIM_CODE_TTL_SECONDS,
  clearActiveClaim,
  generateClaimCode,
  loadActiveClaim,
  type PendingClaim,
  pendingClaimKey,
  requireCache,
  setPendingClaimCurrency,
  verifyPendingClaim,
} from "../claim-code";

class FakeCache {
  store = new Map<string, unknown>();
  get = vi.fn(async <T>(key: string): Promise<T | null> =>
    (this.store.has(key) ? (this.store.get(key) as T) : null),
  );
  set = vi.fn(async (key: string, value: unknown, _ttl?: number) => {
    this.store.set(key, value);
  });
  delete = vi.fn(async (key: string) => {
    this.store.delete(key);
  });
  getOrSet = vi.fn(async <T>(key: string, factory: () => Promise<T>) => {
    if (this.store.has(key)) return this.store.get(key) as T;
    const v = await factory();
    this.store.set(key, v);
    return v;
  });
}

function pending(over: Partial<PendingClaim> = {}): PendingClaim {
  return {
    kind: "reward",
    customerId: "cust_1",
    organizationId: "org_1",
    rewardId: "rw_1",
    currency: "stamps",
    code: "123456",
    staffId: "staff_1",
    rewardName: "Bebida gratis",
    expiresAt: "2026-01-01T00:03:00.000Z",
    attempts: 0,
    ...over,
  };
}

describe("generateClaimCode", () => {
  it("returns a zero-padded 6-digit string", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateClaimCode()).toMatch(/^\d{6}$/);
    }
  });
});

describe("requireCache", () => {
  it("throws PRECONDITION_FAILED / CACHE_REQUIRED when absent", () => {
    expect(() => requireCache(undefined)).toThrowError(
      expect.objectContaining({ code: "PRECONDITION_FAILED", message: "CACHE_REQUIRED" }),
    );
  });
  it("returns the cache when present", () => {
    const cache = new FakeCache();
    expect(requireCache(cache as never)).toBe(cache);
  });
});

describe("verifyPendingClaim", () => {
  const ID = "pending_1";
  const STAFF = "staff_1";

  function seed(cache: FakeCache, over: Partial<PendingClaim> = {}) {
    cache.store.set(pendingClaimKey(ID), pending(over));
  }

  it("returns the pending claim on a correct code", async () => {
    const cache = new FakeCache();
    seed(cache);
    const res = await verifyPendingClaim(cache as never, ID, "123456", STAFF);
    expect(res.customerId).toBe("cust_1");
  });

  it("missing → CODE_EXPIRED", async () => {
    const cache = new FakeCache();
    await expect(
      verifyPendingClaim(cache as never, ID, "123456", STAFF),
    ).rejects.toMatchObject({ message: "CODE_EXPIRED" });
  });

  it("staff mismatch → NOT_YOUR_CLAIM", async () => {
    const cache = new FakeCache();
    seed(cache);
    await expect(
      verifyPendingClaim(cache as never, ID, "123456", "other"),
    ).rejects.toMatchObject({ message: "NOT_YOUR_CLAIM" });
  });

  it("wrong code → CODE_INVALID and persists incremented attempts under same TTL", async () => {
    const cache = new FakeCache();
    seed(cache);
    await expect(
      verifyPendingClaim(cache as never, ID, "000000", STAFF),
    ).rejects.toMatchObject({ message: "CODE_INVALID" });
    expect(cache.set).toHaveBeenLastCalledWith(
      pendingClaimKey(ID),
      expect.objectContaining({ attempts: 1 }),
      CLAIM_CODE_TTL_SECONDS,
    );
  });

  it("attempts beyond the max → TOO_MANY_ATTEMPTS and burns the key", async () => {
    const cache = new FakeCache();
    seed(cache, { attempts: 3 });
    await expect(
      verifyPendingClaim(cache as never, ID, "000000", STAFF),
    ).rejects.toMatchObject({ message: "TOO_MANY_ATTEMPTS" });
    expect(cache.store.size).toBe(0);
  });
});

describe("cancelPendingClaim", () => {
  const ID = "pending_1";
  const CUSTOMER = "cust_1";

  function seed(cache: FakeCache, over: Partial<PendingClaim> = {}) {
    cache.store.set(pendingClaimKey(ID), pending(over));
  }

  it("deletes the pending + the active-claim index and reports the kind", async () => {
    const cache = new FakeCache();
    seed(cache, { kind: "streak" });
    cache.store.set(activeClaimKey(CUSTOMER), ID);
    const res = await cancelPendingClaim(cache as never, ID, CUSTOMER);
    expect(res).toEqual({ cancelled: true, kind: "streak" });
    expect(cache.store.size).toBe(0);
  });

  it("is idempotent when the pending is missing (no throw)", async () => {
    const cache = new FakeCache();
    const res = await cancelPendingClaim(cache as never, ID, CUSTOMER);
    expect(res).toEqual({ cancelled: false });
    expect(cache.delete).not.toHaveBeenCalled();
  });

  it("rejects when the pending belongs to another customer", async () => {
    const cache = new FakeCache();
    seed(cache, { customerId: "someone-else" });
    await expect(
      cancelPendingClaim(cache as never, ID, CUSTOMER),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "NOT_YOUR_CLAIM" });
    // Not deleted — the owner's claim is untouched.
    expect(cache.store.size).toBe(1);
  });

  it("after cancel, verifyPendingClaim fails CODE_EXPIRED", async () => {
    const cache = new FakeCache();
    seed(cache);
    await cancelPendingClaim(cache as never, ID, CUSTOMER);
    await expect(
      verifyPendingClaim(cache as never, ID, "123456", "staff_1"),
    ).rejects.toMatchObject({ message: "CODE_EXPIRED" });
  });
});

describe("loadActiveClaim", () => {
  const ID = "pending_1";
  const CUSTOMER = "cust_1";

  it("returns null when no cache is bound", async () => {
    await expect(loadActiveClaim(undefined, CUSTOMER)).resolves.toBeNull();
  });

  it("returns null when there is no active-claim index", async () => {
    const cache = new FakeCache();
    await expect(loadActiveClaim(cache as never, CUSTOMER)).resolves.toBeNull();
  });

  it("reads the indexed pending and projects the active-claim view", async () => {
    const cache = new FakeCache();
    cache.store.set(activeClaimKey(CUSTOMER), ID);
    cache.store.set(
      pendingClaimKey(ID),
      pending({ cost: { stamps: 9 }, expiresAt: "2026-01-01T00:03:00.000Z" }),
    );
    await expect(loadActiveClaim(cache as never, CUSTOMER)).resolves.toEqual({
      pendingId: ID,
      code: "123456",
      rewardName: "Bebida gratis",
      cost: { stamps: 9 },
      expiresAt: "2026-01-01T00:03:00.000Z",
      kind: "reward",
      // The fixture has a decided currency + no affordable set.
      affordableWith: undefined,
      currency: "stamps",
    });
  });

  it("cleans a stale index when the pending is gone and returns null", async () => {
    const cache = new FakeCache();
    cache.store.set(activeClaimKey(CUSTOMER), ID);
    await expect(loadActiveClaim(cache as never, CUSTOMER)).resolves.toBeNull();
    expect(cache.store.has(activeClaimKey(CUSTOMER))).toBe(false);
  });

  it("returns null when the indexed pending belongs to another customer", async () => {
    const cache = new FakeCache();
    cache.store.set(activeClaimKey(CUSTOMER), ID);
    cache.store.set(pendingClaimKey(ID), pending({ customerId: "someone-else" }));
    await expect(loadActiveClaim(cache as never, CUSTOMER)).resolves.toBeNull();
  });
});

describe("setPendingClaimCurrency", () => {
  const ID = "pending_1";
  const CUSTOMER = "cust_1";

  function seed(cache: FakeCache, over: Partial<PendingClaim> = {}) {
    cache.store.set(
      pendingClaimKey(ID),
      pending({
        currency: undefined,
        affordableWith: ["stamps", "points"],
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
        ...over,
      }),
    );
  }

  it("records the chosen currency (in affordableWith) under a non-extending TTL", async () => {
    const cache = new FakeCache();
    seed(cache);
    const res = await setPendingClaimCurrency(
      cache as never,
      ID,
      CUSTOMER,
      "points",
    );
    expect(res).toEqual({ ok: true });
    const stored = cache.store.get(pendingClaimKey(ID)) as PendingClaim;
    expect(stored.currency).toBe("points");
    // TTL is the remaining life (≈120s), never the full 180.
    const ttl = cache.set.mock.calls.at(-1)![2]!;
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(120);
  });

  it("missing pending → CODE_EXPIRED", async () => {
    const cache = new FakeCache();
    await expect(
      setPendingClaimCurrency(cache as never, ID, CUSTOMER, "stamps"),
    ).rejects.toMatchObject({ message: "CODE_EXPIRED" });
  });

  it("foreign customer → NOT_YOUR_CLAIM", async () => {
    const cache = new FakeCache();
    seed(cache, { customerId: "someone-else" });
    await expect(
      setPendingClaimCurrency(cache as never, ID, CUSTOMER, "stamps"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "NOT_YOUR_CLAIM" });
  });

  it("currency not in affordableWith → CURRENCY_NOT_ALLOWED", async () => {
    const cache = new FakeCache();
    seed(cache, { affordableWith: ["stamps"] });
    await expect(
      setPendingClaimCurrency(cache as never, ID, CUSTOMER, "points"),
    ).rejects.toMatchObject({ message: "CURRENCY_NOT_ALLOWED" });
  });
});

describe("clearActiveClaim", () => {
  const ID = "pending_1";
  const CUSTOMER = "cust_1";

  it("no-ops with no cache", async () => {
    await expect(clearActiveClaim(undefined, CUSTOMER)).resolves.toBeUndefined();
  });

  it("no-ops when there is no active-claim index", async () => {
    const cache = new FakeCache();
    await clearActiveClaim(cache as never, CUSTOMER);
    expect(cache.delete).not.toHaveBeenCalled();
  });

  it("clears the pending + index for the same reward and leaves loadActiveClaim null", async () => {
    const cache = new FakeCache();
    cache.store.set(activeClaimKey(CUSTOMER), ID);
    cache.store.set(pendingClaimKey(ID), pending({ rewardId: "rw_1" }));
    await clearActiveClaim(cache as never, CUSTOMER, "rw_1");
    expect(cache.store.size).toBe(0);
    await expect(loadActiveClaim(cache as never, CUSTOMER)).resolves.toBeNull();
  });

  it("leaves a code for a DIFFERENT reward intact", async () => {
    const cache = new FakeCache();
    cache.store.set(activeClaimKey(CUSTOMER), ID);
    cache.store.set(pendingClaimKey(ID), pending({ rewardId: "rw_2" }));
    await clearActiveClaim(cache as never, CUSTOMER, "rw_1");
    expect(cache.store.has(pendingClaimKey(ID))).toBe(true);
    expect(cache.store.has(activeClaimKey(CUSTOMER))).toBe(true);
  });

  it("clears regardless of reward when no rewardId is given", async () => {
    const cache = new FakeCache();
    cache.store.set(activeClaimKey(CUSTOMER), ID);
    cache.store.set(pendingClaimKey(ID), pending({ rewardId: "rw_9" }));
    await clearActiveClaim(cache as never, CUSTOMER);
    expect(cache.store.size).toBe(0);
  });

  it("cleans a dangling index when the pending is gone", async () => {
    const cache = new FakeCache();
    cache.store.set(activeClaimKey(CUSTOMER), ID);
    await clearActiveClaim(cache as never, CUSTOMER, "rw_1");
    expect(cache.store.has(activeClaimKey(CUSTOMER))).toBe(false);
  });
});
