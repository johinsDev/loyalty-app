import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadActiveClaim } from "../../_shared/claim-code";
import { signStreakClaimToken } from "../claim-token";
import type {
  AdvanceResult,
  ClaimResult,
  StreaksRepository,
} from "../repository";
import { StreaksService } from "../service";

const SECRET = "test-secret-min-32-chars-pad-pad-pad-pad";
const ORG = "org_1";
const STAFF = "staff_1";
const CUSTOMER = "cust_1";

/** In-memory stand-in for `StreaksRepository` — canned results per test. */
class FakeRepo {
  advanceResult: AdvanceResult = { changed: true, completed: false, currentCount: 2 };
  claimResult: ClaimResult = { kind: "claimed" };
  pending: { id: string } | null = null;

  advanceForPurchase = vi.fn(async () => this.advanceResult);
  claimStreak = vi.fn(async () => this.claimResult);
  pendingReward = vi.fn(async () => this.pending ?? undefined);
  view = vi.fn(async () => ({
    currentCount: 2,
    goalDays: 5,
    status: "active" as const,
    rewardPending: false,
    week: [],
  }));
  history = vi.fn(async () => []);
}

/** Minimal in-memory cache satisfying CacheBinding; TTL ignored (fine for UT). */
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
  const enqueue = vi.fn(async () => undefined);
  const service = new StreaksService(repo as unknown as StreaksRepository, {
    realtime,
    signSecret: SECRET,
    cache: opts.cache as never,
    enqueue,
  });
  return { service, realtime, enqueue };
}

describe("StreaksService.advanceForPurchase", () => {
  let repo: FakeRepo;
  beforeEach(() => {
    repo = new FakeRepo();
  });

  it("publishes streak.advanced and does NOT enqueue on a normal advance", async () => {
    repo.advanceResult = { changed: true, completed: false, currentCount: 3 };
    const { service, realtime, enqueue } = build(repo);
    await service.advanceForPurchase(ORG, CUSTOMER);
    expect(realtime.publish).toHaveBeenCalledWith(
      `customer:${CUSTOMER}`,
      expect.objectContaining({
        event: "streak.advanced",
        data: { currentCount: 3 },
      }),
    );
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("publishes streak.completed and enqueues streak-completed when it completes", async () => {
    repo.advanceResult = { changed: true, completed: true, currentCount: 5 };
    const { service, realtime, enqueue } = build(repo);
    await service.advanceForPurchase(ORG, CUSTOMER);
    expect(realtime.publish).toHaveBeenCalledWith(
      `customer:${CUSTOMER}`,
      expect.objectContaining({ event: "streak.completed" }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationKey: "streak-completed",
        customerIds: [CUSTOMER],
        payload: { currentCount: 5 },
      }),
    );
  });

  it("does nothing when paused / unchanged (already counted today or reward pending)", async () => {
    repo.advanceResult = { changed: false, completed: false, currentCount: 5 };
    const { service, realtime, enqueue } = build(repo);
    await service.advanceForPurchase(ORG, CUSTOMER);
    expect(realtime.publish).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe("StreaksService claim", () => {
  let repo: FakeRepo;
  beforeEach(() => {
    repo = new FakeRepo();
  });

  it("issueClaimToken throws when no reward is pending", async () => {
    repo.pending = null;
    const { service } = build(repo);
    await expect(service.issueClaimToken(ORG, CUSTOMER)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  it("issueClaimToken returns a verifiable token for the pending streak", async () => {
    repo.pending = { id: "s9" };
    const { service } = build(repo);
    const res = await service.issueClaimToken(ORG, CUSTOMER);
    expect(res.streakId).toBe("s9");
    const { verifyStreakClaimToken } = await import("../claim-token");
    await expect(verifyStreakClaimToken(res.token, SECRET)).resolves.toEqual({
      customerId: CUSTOMER,
      streakId: "s9",
    });
  });

  it("claimReward confirms a valid token and fires the claimed side effects", async () => {
    const { token } = await signStreakClaimToken({
      customerId: CUSTOMER,
      streakId: "s9",
      secret: SECRET,
    });
    repo.claimResult = { kind: "claimed" };
    const { service, realtime, enqueue } = build(repo);
    const res = await service.claimReward(ORG, STAFF, token);
    expect(res.ok).toBe(true);
    expect(realtime.publish).toHaveBeenCalledWith(
      `customer:${CUSTOMER}`,
      expect.objectContaining({ event: "streak.reward.claimed" }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ notificationKey: "streak-reward-claimed" }),
    );
  });

  it("rejects an invalid/forged token", async () => {
    const { service } = build(repo);
    await expect(service.claimReward(ORG, STAFF, "nope")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "INVALID_TOKEN",
    });
  });

  it("rejects a replay once the streak is already claimed", async () => {
    const { token } = await signStreakClaimToken({
      customerId: CUSTOMER,
      streakId: "s9",
      secret: SECRET,
    });
    repo.claimResult = { kind: "not_pending" };
    const { service } = build(repo);
    await expect(service.claimReward(ORG, STAFF, token)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "ALREADY_CLAIMED",
    });
  });
});

describe("StreaksService.requestClaim (code-based)", () => {
  let repo: FakeRepo;
  let cache: FakeCache;
  beforeEach(() => {
    repo = new FakeRepo();
    cache = new FakeCache();
  });

  it("stores a pending streak claim with a 6-digit code, publishes + enqueues, hides the code", async () => {
    repo.pending = { id: "s9" };
    const { service, realtime, enqueue } = build(repo, { cache });
    const res = await service.requestClaim(ORG, STAFF, CUSTOMER);

    expect(res.pendingId).toBeTruthy();
    expect(JSON.stringify(res)).not.toContain('"code"');

    const stored = [...cache.store.values()][0] as {
      code: string;
      staffId: string;
      kind: string;
      rewardId: string;
    };
    expect(stored.code).toMatch(/^\d{6}$/);
    expect(stored.staffId).toBe(STAFF);
    expect(stored.kind).toBe("streak");
    expect(stored.rewardId).toBe("s9");

    expect(res.expiresAt).toBeTruthy();
    expect(realtime.publish).toHaveBeenCalledWith(
      `customer:${CUSTOMER}`,
      expect.objectContaining({
        event: "reward.claim-code",
        data: expect.objectContaining({ expiresAt: res.expiresAt }),
      }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ notificationKey: "reward-claim-code" }),
    );
  });

  it("throws NO_REWARD_PENDING when nothing is pending", async () => {
    repo.pending = null;
    const { service } = build(repo, { cache });
    await expect(service.requestClaim(ORG, STAFF, CUSTOMER)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "NO_REWARD_PENDING",
    });
  });

  it("throws CACHE_REQUIRED when no cache is bound", async () => {
    repo.pending = { id: "s9" };
    const { service } = build(repo);
    await expect(service.requestClaim(ORG, STAFF, CUSTOMER)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "CACHE_REQUIRED",
    });
  });
});

describe("StreaksService.confirmClaimWithCode", () => {
  let repo: FakeRepo;
  let cache: FakeCache;
  beforeEach(() => {
    repo = new FakeRepo();
    cache = new FakeCache();
  });

  async function seedPending(over: Record<string, unknown> = {}) {
    repo.pending = { id: "s9" };
    const { service } = build(repo, { cache });
    const res = await service.requestClaim(ORG, STAFF, CUSTOMER);
    const key = [...cache.store.keys()][0]!;
    const pending = cache.store.get(key) as { code: string };
    if (Object.keys(over).length) cache.store.set(key, { ...pending, ...over });
    return { pendingId: res.pendingId, code: pending.code };
  }

  it("success: claims via claimStreak, fires side effects, deletes the pending", async () => {
    repo.claimResult = { kind: "claimed" };
    const { pendingId, code } = await seedPending();
    const { service, realtime, enqueue } = build(repo, { cache });

    const res = await service.confirmClaimWithCode(ORG, STAFF, pendingId, code);

    expect(res.ok).toBe(true);
    expect(repo.claimStreak).toHaveBeenCalledWith(
      expect.objectContaining({ streakId: "s9", customerId: CUSTOMER }),
    );
    expect(realtime.publish).toHaveBeenCalledWith(
      `customer:${CUSTOMER}`,
      expect.objectContaining({ event: "streak.reward.claimed" }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ notificationKey: "streak-reward-claimed" }),
    );
    expect(cache.store.size).toBe(0);
  });

  it("wrong code → CODE_INVALID and increments attempts", async () => {
    const { pendingId } = await seedPending();
    const { service } = build(repo, { cache });
    await expect(
      service.confirmClaimWithCode(ORG, STAFF, pendingId, "000000"),
    ).rejects.toMatchObject({ message: "CODE_INVALID" });
    const stored = [...cache.store.values()][0] as { attempts: number };
    expect(stored.attempts).toBe(1);
    expect(repo.claimStreak).not.toHaveBeenCalled();
  });

  it("4th attempt → TOO_MANY_ATTEMPTS and burns the pending", async () => {
    const { pendingId } = await seedPending({ attempts: 3 });
    const { service } = build(repo, { cache });
    await expect(
      service.confirmClaimWithCode(ORG, STAFF, pendingId, "000000"),
    ).rejects.toMatchObject({ message: "TOO_MANY_ATTEMPTS" });
    // The pending is burned; the index lingers (harmless — TTL-expires).
    expect(cache.store.has(`claim-otp:${pendingId}`)).toBe(false);
  });

  it("expired / missing → CODE_EXPIRED", async () => {
    const { service } = build(repo, { cache });
    await expect(
      service.confirmClaimWithCode(ORG, STAFF, "nope", "123456"),
    ).rejects.toMatchObject({ message: "CODE_EXPIRED" });
  });

  it("staff mismatch → NOT_YOUR_CLAIM", async () => {
    const { pendingId, code } = await seedPending();
    const { service } = build(repo, { cache });
    await expect(
      service.confirmClaimWithCode(ORG, "other-staff", pendingId, code),
    ).rejects.toMatchObject({ message: "NOT_YOUR_CLAIM" });
  });

  it("reused pendingId after success → CODE_EXPIRED", async () => {
    repo.claimResult = { kind: "claimed" };
    const { pendingId, code } = await seedPending();
    const { service } = build(repo, { cache });
    await service.confirmClaimWithCode(ORG, STAFF, pendingId, code);
    await expect(
      service.confirmClaimWithCode(ORG, STAFF, pendingId, code),
    ).rejects.toMatchObject({ message: "CODE_EXPIRED" });
  });
});

describe("StreaksService.cancelClaim (customer)", () => {
  let repo: FakeRepo;
  let cache: FakeCache;
  beforeEach(() => {
    repo = new FakeRepo();
    cache = new FakeCache();
  });

  async function seedPending() {
    repo.pending = { id: "s9" };
    const { service } = build(repo, { cache });
    const res = await service.requestClaim(ORG, STAFF, CUSTOMER);
    return res.pendingId;
  }

  it("deletes the pending and publishes reward.claim-code-cancelled", async () => {
    const pendingId = await seedPending();
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
    const pendingId = await seedPending();
    const { service } = build(repo, { cache });
    await expect(
      service.cancelClaim("other-customer", pendingId),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "NOT_YOUR_CLAIM" });
    // Nothing deleted — the pending survives the foreign cancel attempt.
    expect(cache.store.has(`claim-otp:${pendingId}`)).toBe(true);
  });

  it("after cancel, confirmClaimWithCode fails CODE_EXPIRED", async () => {
    repo.pending = { id: "s9" };
    const { service } = build(repo, { cache });
    const res = await service.requestClaim(ORG, STAFF, CUSTOMER);
    const key = [...cache.store.keys()].find((k) => k.startsWith("claim-otp:"))!;
    const code = (cache.store.get(key) as { code: string }).code;
    await service.cancelClaim(CUSTOMER, res.pendingId);
    await expect(
      service.confirmClaimWithCode(ORG, STAFF, res.pendingId, code),
    ).rejects.toMatchObject({ message: "CODE_EXPIRED" });
  });
});

describe("StreaksService active-claim index (rehydrate)", () => {
  let repo: FakeRepo;
  let cache: FakeCache;
  beforeEach(() => {
    repo = new FakeRepo();
    cache = new FakeCache();
  });

  async function seedPending() {
    repo.pending = { id: "s9" };
    const { service } = build(repo, { cache });
    const res = await service.requestClaim(ORG, STAFF, CUSTOMER);
    const key = [...cache.store.keys()].find((k) => k.startsWith("claim-otp:"))!;
    return {
      pendingId: res.pendingId,
      code: (cache.store.get(key) as { code: string }).code,
      expiresAt: res.expiresAt,
    };
  }

  it("requestClaim stores expiresAt + sets the active-claim index; loadActiveClaim reads it back as a streak", async () => {
    const { pendingId, code, expiresAt } = await seedPending();
    expect(cache.store.get(`active-claim:${CUSTOMER}`)).toBe(pendingId);
    await expect(
      loadActiveClaim(cache as never, CUSTOMER),
    ).resolves.toEqual({
      pendingId,
      code,
      rewardName: "Premio de racha",
      cost: {},
      expiresAt,
      kind: "streak",
    });
  });

  it("clears the index after the customer cancels", async () => {
    const { pendingId } = await seedPending();
    const { service } = build(repo, { cache });
    await service.cancelClaim(CUSTOMER, pendingId);
    await expect(loadActiveClaim(cache as never, CUSTOMER)).resolves.toBeNull();
  });

  it("clears the index after a successful confirmClaimWithCode", async () => {
    repo.claimResult = { kind: "claimed" };
    const { pendingId, code } = await seedPending();
    const { service } = build(repo, { cache });
    await service.confirmClaimWithCode(ORG, STAFF, pendingId, code);
    await expect(loadActiveClaim(cache as never, CUSTOMER)).resolves.toBeNull();
  });

  it("cleans a stale index when the pending expired", async () => {
    const { pendingId } = await seedPending();
    cache.store.delete(`claim-otp:${pendingId}`);
    await expect(loadActiveClaim(cache as never, CUSTOMER)).resolves.toBeNull();
    expect(cache.store.has(`active-claim:${CUSTOMER}`)).toBe(false);
  });
});
