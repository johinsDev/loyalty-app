import { beforeEach, describe, expect, it, vi } from "vitest";

import { signClaimToken } from "../claim-token";
import type { ClaimResult, RecordResult, StampsRepository } from "../repository";
import { StampsService } from "../service";
import type { WalletView } from "../schemas";

const SECRET = "test-secret-min-32-chars-pad-pad-pad-pad";
const ORG = "org_1";
const STAFF = "staff_1";
const CUSTOMER = "cust_1";

function view(over: Partial<WalletView> = {}): WalletView {
  return {
    id: "w1",
    currentStamps: 1,
    walletSize: 10,
    stampsGoal: 9,
    status: "active",
    sequence: 1,
    rewardPending: false,
    ...over,
  };
}

/** In-memory stand-in for `StampsRepository` — canned results per test. */
class FakeRepo {
  recordResult: RecordResult = {
    kind: "recorded",
    wallet: view(),
    purchaseId: "p1",
    completed: false,
  };
  claimResult: ClaimResult = {
    kind: "claimed",
    walletId: "w1",
    newWallet: view({ id: "w2", currentStamps: 0, sequence: 2 }),
  };
  pending: { id: string } | null = null;

  recordPurchase = vi.fn(async () => this.recordResult);
  claimWallet = vi.fn(async () => this.claimResult);
  pendingWallet = vi.fn(async () => this.pending);
  walletView = vi.fn(async () => view());
  history = vi.fn(async () => ({ rows: [], total: 0 }));
  completedWallets = vi.fn(async () => []);
}

function build(repo: FakeRepo) {
  const realtime = { publish: vi.fn(async () => undefined) };
  const enqueue = vi.fn(async () => undefined);
  const service = new StampsService(repo as unknown as StampsRepository, {
    realtime,
    signSecret: SECRET,
    enqueue,
  });
  return { service, realtime, enqueue };
}

describe("StampsService.recordPurchase", () => {
  let repo: FakeRepo;
  beforeEach(() => {
    repo = new FakeRepo();
  });

  it("fires a first-purchase notification on the very first stamp", async () => {
    // Default FakeRepo result = wallet seq 1, currentStamps 1 → first ever.
    const { service, realtime, enqueue } = build(repo);
    const wallet = await service.recordPurchase(ORG, STAFF, {
      customerId: CUSTOMER,
      priceCents: 1500,
      idempotencyKey: "idem-12345678",
    });
    expect(wallet.currentStamps).toBe(1);
    expect(realtime.publish).toHaveBeenCalledWith(
      `customer:${CUSTOMER}`,
      expect.objectContaining({ event: "stamp.earned" }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationKey: "first-purchase",
        customerIds: [CUSTOMER],
      }),
    );
  });

  it("fires a stamp-earned notification on a subsequent stamp", async () => {
    repo.recordResult = {
      kind: "recorded",
      wallet: view({ currentStamps: 2 }),
      purchaseId: "p2",
      completed: false,
    };
    const { service, enqueue } = build(repo);
    await service.recordPurchase(ORG, STAFF, {
      customerId: CUSTOMER,
      priceCents: 1500,
      idempotencyKey: "idem-87654321",
    });
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ notificationKey: "stamp-earned" }),
    );
  });

  it("flags completion when the wallet fills", async () => {
    repo.recordResult = {
      kind: "recorded",
      wallet: view({ currentStamps: 10, status: "completed", rewardPending: true }),
      purchaseId: "p10",
      completed: true,
    };
    const { service, realtime } = build(repo);
    await service.recordPurchase(ORG, STAFF, {
      customerId: CUSTOMER,
      priceCents: 1500,
      idempotencyKey: "idem-completes",
    });
    expect(realtime.publish).toHaveBeenCalledWith(
      `customer:${CUSTOMER}`,
      expect.objectContaining({
        data: expect.objectContaining({ completed: true }),
      }),
    );
  });

  it("blocks a purchase when a reward is pending (no side effects)", async () => {
    repo.recordResult = {
      kind: "reward_pending",
      wallet: view({ currentStamps: 10, status: "completed", rewardPending: true }),
    };
    const { service, realtime, enqueue } = build(repo);
    await expect(
      service.recordPurchase(ORG, STAFF, {
        customerId: CUSTOMER,
        priceCents: 1500,
        idempotencyKey: "idem-blocked",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", message: "REWARD_PENDING" });
    expect(realtime.publish).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("is idempotent on retry — no duplicate stamp or notification", async () => {
    repo.recordResult = {
      kind: "idempotent",
      wallet: view({ currentStamps: 1 }),
      purchaseId: "p1",
    };
    const { service, realtime, enqueue } = build(repo);
    const wallet = await service.recordPurchase(ORG, STAFF, {
      customerId: CUSTOMER,
      priceCents: 1500,
      idempotencyKey: "idem-retry",
    });
    expect(wallet.currentStamps).toBe(1);
    expect(realtime.publish).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe("StampsService claim", () => {
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

  it("issueClaimToken returns a verifiable token for the pending wallet", async () => {
    repo.pending = { id: "w9" };
    const { service } = build(repo);
    const res = await service.issueClaimToken(ORG, CUSTOMER);
    expect(res.walletId).toBe("w9");
    // Round-trips through the real verifier (proves the signature + payload).
    const { verifyClaimToken } = await import("../claim-token");
    await expect(verifyClaimToken(res.token, SECRET)).resolves.toEqual({
      customerId: CUSTOMER,
      walletId: "w9",
    });
  });

  it("claim confirms a valid token and opens the next wallet", async () => {
    const { token } = await signClaimToken({
      customerId: CUSTOMER,
      walletId: "w9",
      secret: SECRET,
    });
    repo.claimResult = {
      kind: "claimed",
      walletId: "w9",
      newWallet: view({ id: "w10", currentStamps: 0, sequence: 2 }),
    };
    const { service, realtime, enqueue } = build(repo);
    const res = await service.claim(ORG, STAFF, token);
    expect(res.ok).toBe(true);
    expect(res.newWallet.sequence).toBe(2);
    expect(realtime.publish).toHaveBeenCalledWith(
      `customer:${CUSTOMER}`,
      expect.objectContaining({ event: "reward.claimed" }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ notificationKey: "reward-claimed" }),
    );
  });

  it("rejects an invalid/forged token", async () => {
    const { service } = build(repo);
    await expect(service.claim(ORG, STAFF, "not-a-real-token")).rejects.toMatchObject(
      { code: "BAD_REQUEST", message: "INVALID_TOKEN" },
    );
  });

  it("rejects a replay once the wallet is already claimed", async () => {
    const { token } = await signClaimToken({
      customerId: CUSTOMER,
      walletId: "w9",
      secret: SECRET,
    });
    repo.claimResult = { kind: "not_pending" };
    const { service } = build(repo);
    await expect(service.claim(ORG, STAFF, token)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "ALREADY_CLAIMED",
    });
  });
});
