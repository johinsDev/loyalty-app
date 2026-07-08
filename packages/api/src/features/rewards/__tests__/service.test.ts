import type { RewardRow } from "@loyalty/db/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PendingClaim } from "../../_shared/claim-code";
import { signRewardClaimToken } from "../claim-token";
import type { Balances, RewardsRepository } from "../repository";
import { RewardsService } from "../service";

const SECRET = "test-secret-min-32-chars-pad-pad-pad-pad";
const ORG = "org_1";
const STAFF = "staff_1";
const CUSTOMER = "cust_1";

function reward(over: Partial<RewardRow> = {}): RewardRow {
  return {
    id: "rw_1",
    organizationId: ORG,
    name: "Bebida gratis",
    description: null,
    imageUrl: null,
    stampsRequired: 9,
    pointsCost: null,
    costMode: "or",
    allowedTiers: null,
    sections: ["destacados"],
    sortOrder: 1,
    limitPerCustomer: "unlimited",
    active: true,
    status: "published",
    type: null,
    benefit: null,
    fulfillmentNote: null,
    backgroundCss: null,
    icon: null,
    createdByUserId: null,
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as RewardRow;
}

class FakeRepo {
  catalog: RewardRow[] = [reward()];
  balancesValue: Balances = { stamps: 9, points: 0 };
  tier = "hoja";
  claimedCount = new Map<string, number>();
  claimedIds = new Set<string>();
  lastRedeemed = new Map<string, Date>();
  tierTotal = 0;

  listCatalog = vi.fn(async () => ({ rows: this.catalog, nextCursor: null }));
  getReward = vi.fn(async (_org: string, id: string) =>
    this.catalog.find((r) => r.id === id) ?? null,
  );
  balances = vi.fn(async () => this.balancesValue);
  tierKey = vi.fn(async () => this.tier);
  pointsTierTotal = vi.fn(async () => this.tierTotal);
  claimedCountByReward = vi.fn(async () => this.claimedCount);
  claimedRewardIds = vi.fn(async () => this.claimedIds);
  lastRedeemedAtByReward = vi.fn(async () => this.lastRedeemed);
  recentRedemptions = vi.fn(async () => []);
  redemptionHistory = vi.fn(async () => ({ items: [], nextCursor: null }));
  upsertAvailable = vi.fn(async () => undefined);
}

/** Minimal in-memory cache satisfying the router's CacheBinding (get/set/delete
 *  + getOrSet), with TTL ignored — fine for unit tests. */
class FakeCache {
  store = new Map<string, unknown>();
  get = vi.fn(async <T>(key: string): Promise<T | null> =>
    (this.store.has(key) ? (this.store.get(key) as T) : null),
  );
  set = vi.fn(async (key: string, value: unknown) => {
    this.store.set(key, value);
  });
  delete = vi.fn(async (key: string) => {
    this.store.delete(key);
  });
  getOrSet = vi.fn(
    async <T>(key: string, factory: () => Promise<T>): Promise<T> => {
      if (this.store.has(key)) return this.store.get(key) as T;
      const v = await factory();
      this.store.set(key, v);
      return v;
    },
  );
}

function build(repo: FakeRepo, opts: { cache?: FakeCache } = {}) {
  const realtime = { publish: vi.fn(async () => undefined) };
  const enqueue =
    vi.fn<(p: { notificationKey: string }) => Promise<void>>(async () => {});
  const service = new RewardsService(repo as unknown as RewardsRepository, {
    realtime,
    signSecret: SECRET,
    cache: opts.cache as never,
    enqueue: enqueue as never,
  });
  return { service, realtime, enqueue };
}

describe("RewardsService.list", () => {
  let repo: FakeRepo;
  beforeEach(() => {
    repo = new FakeRepo();
  });

  it("derives ready/upcoming/locked/redeemed and groups sections", async () => {
    repo.catalog = [
      reward({ id: "ready", stampsRequired: 9, sections: ["destacados"] }),
      reward({ id: "upcoming", stampsRequired: 20, sections: ["novedades"] }),
      reward({ id: "locked", pointsCost: 80, allowedTiers: ["oro"], sections: [] }),
    ];
    repo.balancesValue = { stamps: 9, points: 0 };
    const { service } = build(repo);
    const res = await service.list(ORG, CUSTOMER, {
      filter: "all",
      limit: 20,
    });
    const byId = Object.fromEntries(res.items.map((i) => [i.id, i.status]));
    expect(byId).toEqual({
      ready: "ready",
      upcoming: "upcoming",
      locked: "locked",
    });
    // Sections: destacados row has the ready item; novedades has the upcoming.
    const sectionKeys = res.sections.map((s) => s.key).sort();
    expect(sectionKeys).toEqual(["destacados", "novedades"]);
  });

  it("filter=listos returns only ready items", async () => {
    repo.catalog = [
      reward({ id: "ready", stampsRequired: 9 }),
      reward({ id: "up", stampsRequired: 50 }),
    ];
    const { service } = build(repo);
    const res = await service.list(ORG, CUSTOMER, { filter: "listos", limit: 20 });
    expect(res.items.map((i) => i.id)).toEqual(["ready"]);
  });

  it("filter=listos paginates the FILTERED set, not the raw catalog page", async () => {
    // Regression for the empty "Listas para canjear": when the first raw page
    // is mostly upcoming, the filtered page must still be full (limit) of ready
    // items and carry a cursor — not come back empty with leftover unfiltered
    // rows hidden on later pages.
    repo.catalog = [
      ...Array.from({ length: 25 }, (_, i) =>
        reward({ id: `up_${i}`, stampsRequired: 999 }),
      ),
      reward({ id: "ready_a", stampsRequired: 9 }),
      reward({ id: "ready_b", stampsRequired: 9 }),
    ];
    repo.balancesValue = { stamps: 9, points: 0 };
    const { service } = build(repo);
    const res = await service.list(ORG, CUSTOMER, { filter: "listos", limit: 20 });
    expect(res.items.map((i) => i.id)).toEqual(["ready_a", "ready_b"]);
    expect(res.nextCursor).toBeNull();
  });

  it("paginates a large filtered set across pages (cursor on the filtered list)", async () => {
    repo.catalog = Array.from({ length: 30 }, (_, i) =>
      reward({ id: `r_${i}`, stampsRequired: 9 }),
    );
    repo.balancesValue = { stamps: 9, points: 0 };
    const { service } = build(repo);
    const page1 = await service.list(ORG, CUSTOMER, { filter: "listos", limit: 20 });
    expect(page1.items).toHaveLength(20);
    expect(page1.nextCursor).toBe("r_19");
    const page2 = await service.list(ORG, CUSTOMER, {
      filter: "listos",
      limit: 20,
      cursor: page1.nextCursor ?? undefined,
    });
    expect(page2.items.map((i) => i.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `r_${i + 20}`),
    );
    expect(page2.nextCursor).toBeNull();
  });
});

describe("RewardsService.availableForCustomer", () => {
  let repo: FakeRepo;
  beforeEach(() => {
    repo = new FakeRepo();
  });

  it("includes per-currency affordability for an OR reward (only the affordable ones)", async () => {
    // OR reward: 5 sellos o 50 pts. Customer has 3 sellos (can't) + 80 pts (can).
    repo.catalog = [
      reward({
        id: "or",
        stampsRequired: 5,
        pointsCost: 50,
        costMode: "or",
      }),
    ];
    repo.balancesValue = { stamps: 3, points: 80 };
    const { service } = build(repo);
    const items = await service.availableForCustomer(ORG, CUSTOMER);
    expect(items).toHaveLength(1);
    expect(items[0]!.affordableWith).toEqual(["points"]);
  });

  it("lists both currencies when both are affordable", async () => {
    repo.catalog = [
      reward({ id: "or", stampsRequired: 5, pointsCost: 50, costMode: "or" }),
    ];
    repo.balancesValue = { stamps: 9, points: 80 };
    const { service } = build(repo);
    const items = await service.availableForCustomer(ORG, CUSTOMER);
    expect(items[0]!.affordableWith).toEqual(["stamps", "points"]);
  });

  it("an AND reward is affordableWith both (it pays with both)", async () => {
    repo.catalog = [
      reward({ id: "and", stampsRequired: 5, pointsCost: 50, costMode: "and" }),
    ];
    repo.balancesValue = { stamps: 9, points: 80 };
    const { service } = build(repo);
    const items = await service.availableForCustomer(ORG, CUSTOMER);
    expect(items[0]!.affordableWith).toEqual(["stamps", "points"]);
  });

  it("a stamps-only reward is affordableWith stamps", async () => {
    repo.catalog = [reward({ id: "s", stampsRequired: 9, pointsCost: null })];
    repo.balancesValue = { stamps: 9, points: 0 };
    const { service } = build(repo);
    const items = await service.availableForCustomer(ORG, CUSTOMER);
    expect(items[0]!.affordableWith).toEqual(["stamps"]);
  });
});

describe("RewardsService.issueClaimToken", () => {
  let repo: FakeRepo;
  beforeEach(() => {
    repo = new FakeRepo();
  });

  it("signs a verifiable token for an affordable reward", async () => {
    repo.balancesValue = { stamps: 9, points: 0 };
    const { service } = build(repo);
    const res = await service.issueClaimToken(ORG, CUSTOMER, "rw_1", "stamps");
    expect(res.rewardId).toBe("rw_1");
    const { verifyRewardClaimToken } = await import("../claim-token");
    await expect(verifyRewardClaimToken(res.token, SECRET)).resolves.toEqual({
      customerId: CUSTOMER,
      rewardId: "rw_1",
      currency: "stamps",
    });
  });

  it("rejects with INSUFFICIENT_BALANCE", async () => {
    repo.balancesValue = { stamps: 3, points: 0 };
    const { service } = build(repo);
    await expect(
      service.issueClaimToken(ORG, CUSTOMER, "rw_1", "stamps"),
    ).rejects.toMatchObject({ message: "INSUFFICIENT_BALANCE" });
  });

  it("rejects with TIER_LOCKED", async () => {
    repo.catalog = [reward({ pointsCost: 80, stampsRequired: null, allowedTiers: ["oro"] })];
    repo.tier = "hoja";
    repo.balancesValue = { stamps: 0, points: 999 };
    const { service } = build(repo);
    await expect(
      service.issueClaimToken(ORG, CUSTOMER, "rw_1", "points"),
    ).rejects.toMatchObject({ message: "TIER_LOCKED" });
  });

  it("rejects with ALREADY_CLAIMED for a once reward", async () => {
    repo.catalog = [reward({ stampsRequired: 1, limitPerCustomer: "once" })];
    repo.claimedIds = new Set(["rw_1"]);
    repo.balancesValue = { stamps: 9, points: 0 };
    const { service } = build(repo);
    await expect(
      service.issueClaimToken(ORG, CUSTOMER, "rw_1", "stamps"),
    ).rejects.toMatchObject({ message: "ALREADY_CLAIMED" });
  });

  it("rejects with NOT_ELIGIBLE when paying a currency the reward doesn't accept", async () => {
    repo.catalog = [reward({ stampsRequired: 9, pointsCost: null })];
    repo.balancesValue = { stamps: 9, points: 999 };
    const { service } = build(repo);
    await expect(
      service.issueClaimToken(ORG, CUSTOMER, "rw_1", "points"),
    ).rejects.toMatchObject({ message: "NOT_ELIGIBLE" });
  });
});

describe("RewardsService.resolveClaim", () => {
  let repo: FakeRepo;
  beforeEach(() => {
    repo = new FakeRepo();
  });

  async function tokenFor(
    rewardId: string,
    currency: "stamps" | "points" | "both",
  ) {
    const { token } = await signRewardClaimToken({
      customerId: CUSTOMER,
      rewardId,
      currency,
      secret: SECRET,
    });
    return token;
  }

  it("resolves a valid token to the customer + reward (no writes)", async () => {
    repo.catalog = [reward({ id: "rw_1", benefit: { type: "experience" }, type: "experience", fulfillmentNote: "Sin fila" })];
    const { service } = build(repo);
    const res = await service.resolveClaim(ORG, await tokenFor("rw_1", "stamps"));
    expect(res.customerId).toBe(CUSTOMER);
    expect(res.currency).toBe("stamps");
    expect(res.reward).toMatchObject({ id: "rw_1", type: "experience", fulfillmentNote: "Sin fila" });
    // Resolve never touches the balance.
    expect(repo.balances).not.toHaveBeenCalled();
  });

  it("rejects a forged token", async () => {
    const { service } = build(repo);
    await expect(service.resolveClaim(ORG, "nope")).rejects.toMatchObject({
      message: "INVALID_TOKEN",
    });
  });

  it("rejects an unpublished reward", async () => {
    repo.catalog = [reward({ id: "rw_1", status: "archived" })];
    const { service } = build(repo);
    await expect(
      service.resolveClaim(ORG, await tokenFor("rw_1", "stamps")),
    ).rejects.toMatchObject({ message: "REWARD_NOT_FOUND" });
  });
});

describe("RewardsService.requestClaim (code-based)", () => {
  let repo: FakeRepo;
  let cache: FakeCache;
  beforeEach(() => {
    repo = new FakeRepo();
    cache = new FakeCache();
  });

  it("stores a pending with a 6-digit code, publishes + enqueues, hides the code", async () => {
    repo.balancesValue = { stamps: 9, points: 0 };
    const { service, realtime, enqueue } = build(repo, { cache });
    const res = await service.requestClaim(ORG, STAFF, CUSTOMER, "rw_1", "stamps");

    expect(res.pendingId).toBeTruthy();
    expect(res.expiresAt).toBeTruthy();
    // The HTTP response never carries the code.
    expect(JSON.stringify(res)).not.toContain('"code"');

    const stored = [...cache.store.values()][0] as {
      code: string;
      staffId: string;
      kind: string;
      attempts: number;
      customerId: string;
    };
    expect(stored.code).toMatch(/^\d{6}$/);
    expect(stored.staffId).toBe(STAFF);
    expect(stored.kind).toBe("reward");
    expect(stored.attempts).toBe(0);
    expect(stored.customerId).toBe(CUSTOMER);

    expect(res.expiresAt).toBeTruthy();
    expect(realtime.publish).toHaveBeenCalledWith(
      `customer:${CUSTOMER}`,
      expect.objectContaining({
        event: "reward.claim-code",
        data: expect.objectContaining({
          pendingId: res.pendingId,
          code: stored.code,
          expiresAt: res.expiresAt,
        }),
      }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationKey: "reward-claim-code",
        payload: expect.objectContaining({ code: stored.code }),
      }),
    );
  });

  it("rejects an ineligible reward with the same validation as the token path", async () => {
    repo.balancesValue = { stamps: 3, points: 0 };
    const { service } = build(repo, { cache });
    await expect(
      service.requestClaim(ORG, STAFF, CUSTOMER, "rw_1", "stamps"),
    ).rejects.toMatchObject({ message: "INSUFFICIENT_BALANCE" });
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("throws CACHE_REQUIRED when no cache is bound", async () => {
    const { service } = build(repo); // no cache
    await expect(
      service.requestClaim(ORG, STAFF, CUSTOMER, "rw_1", "stamps"),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: "CACHE_REQUIRED" });
  });

  it("OR reward affordable with BOTH → leaves currency undecided + stores affordableWith", async () => {
    repo.catalog = [
      reward({ id: "rw_1", stampsRequired: 5, pointsCost: 50, costMode: "or" }),
    ];
    repo.balancesValue = { stamps: 9, points: 80 };
    const { service, realtime } = build(repo, { cache });
    const res = await service.requestClaim(ORG, STAFF, CUSTOMER, "rw_1");

    const stored = cache.store.get(`claim-otp:${res.pendingId}`) as PendingClaim;
    expect(stored.currency).toBeUndefined();
    expect(stored.affordableWith).toEqual(["stamps", "points"]);
    // The realtime payload carries the affordable set + the undecided currency.
    expect(realtime.publish).toHaveBeenCalledWith(
      `customer:${CUSTOMER}`,
      expect.objectContaining({
        event: "reward.claim-code",
        data: expect.objectContaining({
          affordableWith: ["stamps", "points"],
          currency: undefined,
        }),
      }),
    );
  });

  it("OR reward affordable with ONE currency → decides it server-side", async () => {
    repo.catalog = [
      reward({ id: "rw_1", stampsRequired: 5, pointsCost: 50, costMode: "or" }),
    ];
    repo.balancesValue = { stamps: 3, points: 80 }; // only points affordable
    const { service } = build(repo, { cache });
    const res = await service.requestClaim(ORG, STAFF, CUSTOMER, "rw_1");
    const stored = cache.store.get(`claim-otp:${res.pendingId}`) as PendingClaim;
    expect(stored.currency).toBe("points");
    expect(stored.affordableWith).toEqual(["points"]);
  });

  it("AND reward → decides 'both' server-side (no customer choice)", async () => {
    repo.catalog = [
      reward({ id: "rw_1", stampsRequired: 5, pointsCost: 50, costMode: "and" }),
    ];
    repo.balancesValue = { stamps: 9, points: 80 };
    const { service } = build(repo, { cache });
    const res = await service.requestClaim(ORG, STAFF, CUSTOMER, "rw_1");
    const stored = cache.store.get(`claim-otp:${res.pendingId}`) as PendingClaim;
    expect(stored.currency).toBe("both");
  });
});

describe("RewardsService.setClaimCurrency (customer)", () => {
  let repo: FakeRepo;
  let cache: FakeCache;
  beforeEach(() => {
    repo = new FakeRepo();
    cache = new FakeCache();
  });

  async function seedUndecided() {
    repo.catalog = [
      reward({ id: "rw_1", stampsRequired: 5, pointsCost: 50, costMode: "or" }),
    ];
    repo.balancesValue = { stamps: 9, points: 80 };
    const { service } = build(repo, { cache });
    const res = await service.requestClaim(ORG, STAFF, CUSTOMER, "rw_1");
    return res.pendingId;
  }

  it("updates the stored currency when valid + owned", async () => {
    const pendingId = await seedUndecided();
    const { service } = build(repo, { cache });
    const res = await service.setClaimCurrency(CUSTOMER, pendingId, "points");
    expect(res).toEqual({ ok: true });
    const stored = cache.store.get(`claim-otp:${pendingId}`) as PendingClaim;
    expect(stored.currency).toBe("points");
  });

  it("rejects a foreign customer with NOT_YOUR_CLAIM", async () => {
    const pendingId = await seedUndecided();
    const { service } = build(repo, { cache });
    await expect(
      service.setClaimCurrency("other-customer", pendingId, "points"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "NOT_YOUR_CLAIM" });
  });

  it("rejects a currency not in affordableWith", async () => {
    // Single-affordable pending → affordableWith is ["points"] only.
    repo.catalog = [
      reward({ id: "rw_1", stampsRequired: 5, pointsCost: 50, costMode: "or" }),
    ];
    repo.balancesValue = { stamps: 3, points: 80 };
    const { service } = build(repo, { cache });
    const res = await service.requestClaim(ORG, STAFF, CUSTOMER, "rw_1");
    await expect(
      service.setClaimCurrency(CUSTOMER, res.pendingId, "stamps"),
    ).rejects.toMatchObject({ message: "CURRENCY_NOT_ALLOWED" });
  });
});

describe("RewardsService.resolveClaimWithCode", () => {
  let repo: FakeRepo;
  let cache: FakeCache;
  beforeEach(() => {
    repo = new FakeRepo();
    cache = new FakeCache();
  });

  async function seedPending(over: Record<string, unknown> = {}) {
    repo.balancesValue = { stamps: 9, points: 0 };
    const { service } = build(repo, { cache });
    const res = await service.requestClaim(ORG, STAFF, CUSTOMER, "rw_1", "stamps");
    const key = [...cache.store.keys()][0]!;
    const pending = cache.store.get(key) as { code: string };
    if (Object.keys(over).length) {
      cache.store.set(key, { ...pending, ...over });
    }
    return { pendingId: res.pendingId, code: pending.code };
  }

  it("resolves (no deduction), clears the pending, publishes the cancel event", async () => {
    const { pendingId, code } = await seedPending();
    const { service, realtime } = build(repo, { cache });

    const res = await service.resolveClaimWithCode(ORG, STAFF, pendingId, code);

    expect(res.customerId).toBe(CUSTOMER);
    expect(res.reward.id).toBe("rw_1");
    // The phone's active-code sheet is closed.
    expect(realtime.publish).toHaveBeenCalledWith(
      `customer:${CUSTOMER}`,
      expect.objectContaining({ event: "reward.claim-code-cancelled" }),
    );
    expect(cache.store.size).toBe(0);
  });

  it("wrong code → CODE_INVALID and increments attempts", async () => {
    const { pendingId } = await seedPending();
    const { service } = build(repo, { cache });
    await expect(
      service.resolveClaimWithCode(ORG, STAFF, pendingId, "000000"),
    ).rejects.toMatchObject({ message: "CODE_INVALID" });
    const stored = [...cache.store.values()][0] as { attempts: number };
    expect(stored.attempts).toBe(1);
  });

  it("4th attempt → TOO_MANY_ATTEMPTS and burns the pending", async () => {
    const { pendingId } = await seedPending({ attempts: 3 });
    const { service } = build(repo, { cache });
    await expect(
      service.resolveClaimWithCode(ORG, STAFF, pendingId, "000000"),
    ).rejects.toMatchObject({ message: "TOO_MANY_ATTEMPTS" });
    expect(cache.store.has(`claim-otp:${pendingId}`)).toBe(false);
  });

  it("expired / missing pending → CODE_EXPIRED", async () => {
    const { service } = build(repo, { cache });
    await expect(
      service.resolveClaimWithCode(ORG, STAFF, "no-such-id", "123456"),
    ).rejects.toMatchObject({ message: "CODE_EXPIRED" });
  });

  it("staff mismatch → NOT_YOUR_CLAIM", async () => {
    const { pendingId, code } = await seedPending();
    const { service } = build(repo, { cache });
    await expect(
      service.resolveClaimWithCode(ORG, "other-staff", pendingId, code),
    ).rejects.toMatchObject({ message: "NOT_YOUR_CLAIM" });
  });

  it("returns the customer's chosen currency for an OR-both reward", async () => {
    repo.catalog = [
      reward({ id: "rw_1", stampsRequired: 5, pointsCost: 50, costMode: "or" }),
    ];
    repo.balancesValue = { stamps: 9, points: 80 };
    const { service } = build(repo, { cache });
    const res = await service.requestClaim(ORG, STAFF, CUSTOMER, "rw_1");
    const code = (
      cache.store.get(`claim-otp:${res.pendingId}`) as { code: string }
    ).code;
    await service.setClaimCurrency(CUSTOMER, res.pendingId, "points");
    const resolved = await service.resolveClaimWithCode(ORG, STAFF, res.pendingId, code);
    expect(resolved.currency).toBe("points");
  });
});

describe("RewardsService.cancelClaim (customer)", () => {
  let repo: FakeRepo;
  let cache: FakeCache;
  beforeEach(() => {
    repo = new FakeRepo();
    cache = new FakeCache();
  });

  async function seedPending() {
    repo.balancesValue = { stamps: 9, points: 0 };
    const { service } = build(repo, { cache });
    const res = await service.requestClaim(ORG, STAFF, CUSTOMER, "rw_1", "stamps");
    const key = [...cache.store.keys()][0]!;
    return { pendingId: res.pendingId, code: (cache.store.get(key) as { code: string }).code };
  }

  it("deletes the pending and publishes reward.claim-code-cancelled", async () => {
    const { pendingId } = await seedPending();
    const { service, realtime } = build(repo, { cache });
    const res = await service.cancelClaim(CUSTOMER, pendingId);
    expect(res).toEqual({ ok: true });
    expect(cache.store.size).toBe(0);
    expect(realtime.publish).toHaveBeenCalledWith(
      `customer:${CUSTOMER}`,
      expect.objectContaining({
        event: "reward.claim-code-cancelled",
        data: { pendingId },
      }),
    );
  });

  it("is idempotent when the pending is missing (no publish)", async () => {
    const { service, realtime } = build(repo, { cache });
    const res = await service.cancelClaim(CUSTOMER, "no-such-id");
    expect(res).toEqual({ ok: true });
    expect(realtime.publish).not.toHaveBeenCalled();
  });

  it("rejects when the pending belongs to another customer", async () => {
    const { pendingId } = await seedPending();
    const { service } = build(repo, { cache });
    await expect(
      service.cancelClaim("other-customer", pendingId),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "NOT_YOUR_CLAIM" });
    // Nothing deleted — the pending survives the foreign cancel attempt.
    expect(cache.store.has(`claim-otp:${pendingId}`)).toBe(true);
  });

  it("after cancel, resolveClaimWithCode fails CODE_EXPIRED", async () => {
    const { pendingId, code } = await seedPending();
    const { service } = build(repo, { cache });
    await service.cancelClaim(CUSTOMER, pendingId);
    await expect(
      service.resolveClaimWithCode(ORG, STAFF, pendingId, code),
    ).rejects.toMatchObject({ message: "CODE_EXPIRED" });
  });

  it("throws CACHE_REQUIRED when no cache is bound", async () => {
    const { service } = build(repo); // no cache
    await expect(
      service.cancelClaim(CUSTOMER, "any"),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: "CACHE_REQUIRED" });
  });
});

describe("RewardsService.myActiveClaim (rehydrate)", () => {
  let repo: FakeRepo;
  let cache: FakeCache;
  beforeEach(() => {
    repo = new FakeRepo();
    cache = new FakeCache();
  });

  async function seedPending() {
    repo.balancesValue = { stamps: 9, points: 0 };
    const { service } = build(repo, { cache });
    const res = await service.requestClaim(ORG, STAFF, CUSTOMER, "rw_1", "stamps");
    const key = [...cache.store.keys()].find((k) => k.startsWith("claim-otp:"))!;
    return {
      pendingId: res.pendingId,
      code: (cache.store.get(key) as { code: string }).code,
      expiresAt: res.expiresAt,
    };
  }

  it("requestClaim stores expiresAt in the pending + sets the active-claim index", async () => {
    const { pendingId, expiresAt } = await seedPending();
    const pending = cache.store.get(`claim-otp:${pendingId}`) as {
      expiresAt: string;
    };
    expect(pending.expiresAt).toBe(expiresAt);
    expect(cache.store.get(`active-claim:${CUSTOMER}`)).toBe(pendingId);
  });

  it("returns the active claim with code + expiresAt + kind", async () => {
    const { pendingId, code, expiresAt } = await seedPending();
    const { service } = build(repo, { cache });
    await expect(service.myActiveClaim(CUSTOMER)).resolves.toEqual({
      pendingId,
      code,
      rewardName: "Bebida gratis",
      cost: { stamps: 9, points: undefined },
      expiresAt,
      kind: "reward",
      // seedPending passes an explicit "stamps" (back-compat) → decided here,
      // no affordable-set persisted.
      affordableWith: undefined,
      currency: "stamps",
    });
  });

  it("returns null after the customer cancels", async () => {
    const { pendingId } = await seedPending();
    const { service } = build(repo, { cache });
    await service.cancelClaim(CUSTOMER, pendingId);
    await expect(service.myActiveClaim(CUSTOMER)).resolves.toBeNull();
  });

  it("returns null after a successful resolveClaimWithCode", async () => {
    const { pendingId, code } = await seedPending();
    const { service } = build(repo, { cache });
    await service.resolveClaimWithCode(ORG, STAFF, pendingId, code);
    await expect(service.myActiveClaim(CUSTOMER)).resolves.toBeNull();
  });

  it("returns null and cleans the stale index when the pending expired", async () => {
    const { pendingId } = await seedPending();
    // Simulate the pending's TTL elapsing while the index lingers.
    cache.store.delete(`claim-otp:${pendingId}`);
    const { service } = build(repo, { cache });
    await expect(service.myActiveClaim(CUSTOMER)).resolves.toBeNull();
    expect(cache.store.has(`active-claim:${CUSTOMER}`)).toBe(false);
  });

  it("returns null for a foreign customer (index belongs to someone else)", async () => {
    await seedPending();
    const { service } = build(repo, { cache });
    await expect(service.myActiveClaim("other-customer")).resolves.toBeNull();
  });

  it("returns null when no cache is bound", async () => {
    const { service } = build(repo); // no cache
    await expect(service.myActiveClaim(CUSTOMER)).resolves.toBeNull();
  });
});

describe("RewardsService.processPurchaseUnlocks", () => {
  let repo: FakeRepo;
  beforeEach(() => {
    repo = new FakeRepo();
  });

  it("arms availability + emits ONE combined realtime + recap + N db rows", async () => {
    repo.catalog = [reward({ id: "a", stampsRequired: 9 })];
    const { service, realtime, enqueue } = build(repo);
    const unlocked = await service.processPurchaseUnlocks(
      ORG,
      CUSTOMER,
      { stamps: 8, points: 0 },
      { stamps: 9, points: 0 },
    );
    expect(unlocked.map((u) => u.rewardId)).toEqual(["a"]);
    expect(repo.upsertAvailable).toHaveBeenCalledWith(ORG, CUSTOMER, "a");
    // One combined realtime event.
    expect(realtime.publish).toHaveBeenCalledTimes(1);
    expect(realtime.publish).toHaveBeenCalledWith(
      `customer:${CUSTOMER}`,
      expect.objectContaining({ event: "rewards.unlocked" }),
    );
    // One recap (combined WhatsApp/push) + one granular DB row per reward.
    const keys = enqueue.mock.calls.map(
      (c) => (c[0] as { notificationKey: string }).notificationKey,
    );
    expect(keys).toContain("purchase-rewards-recap");
    expect(keys.filter((k) => k === "reward-available")).toHaveLength(1);
  });

  it("does nothing notable on routine earn with no unlocks", async () => {
    repo.catalog = [reward({ id: "a", stampsRequired: 50 })];
    const { service, realtime, enqueue } = build(repo);
    const unlocked = await service.processPurchaseUnlocks(
      ORG,
      CUSTOMER,
      { stamps: 1, points: 0 },
      { stamps: 2, points: 0 },
    );
    expect(unlocked).toEqual([]);
    expect(realtime.publish).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });
});
