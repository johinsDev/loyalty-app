import { beforeEach, describe, expect, it, vi } from "vitest";

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

function build(repo: FakeRepo) {
  const realtime = { publish: vi.fn(async () => undefined) };
  const enqueue = vi.fn(async () => undefined);
  const service = new StreaksService(repo as unknown as StreaksRepository, {
    realtime,
    signSecret: SECRET,
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
