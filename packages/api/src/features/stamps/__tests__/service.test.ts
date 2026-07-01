import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecordResult, StampsRepository } from "../repository";
import { StampsService } from "../service";
import type { WalletView } from "../schemas";

const ORG = "org_1";
const STAFF = "staff_1";
const STORE = "store_1";
const CUSTOMER = "cust_1";

function view(over: Partial<WalletView> = {}): WalletView {
  return {
    id: "w1",
    currentStamps: 1,
    walletSize: 10,
    stampsGoal: 9,
    sequence: 1,
    ...over,
  };
}

/** In-memory stand-in for `StampsRepository` — canned results per test. */
class FakeRepo {
  recordResult: RecordResult = {
    kind: "recorded",
    wallet: view(),
    purchaseId: "p1",
  };

  recordPurchase = vi.fn(async () => this.recordResult);
  walletView = vi.fn(async () => view());
  history = vi.fn(async () => ({ rows: [], total: 0 }));
}

function build(repo: FakeRepo) {
  const realtime = { publish: vi.fn(async () => undefined) };
  const enqueue = vi.fn(async () => undefined);
  const service = new StampsService(repo as unknown as StampsRepository, {
    realtime,
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
    const { wallet } = await service.recordPurchase(ORG, STAFF, STORE, {
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

  it("does NOT enqueue on a routine stamp (the recap owns the per-purchase notif)", async () => {
    repo.recordResult = {
      kind: "recorded",
      wallet: view({ currentStamps: 2 }),
      purchaseId: "p2",
    };
    const { service, realtime, enqueue } = build(repo);
    await service.recordPurchase(ORG, STAFF, STORE, {
      customerId: CUSTOMER,
      priceCents: 1500,
      idempotencyKey: "idem-87654321",
    });
    // Realtime still animates the card; the WhatsApp/feed line is consolidated
    // with points into the purchase-recap at the router level.
    expect(realtime.publish).toHaveBeenCalledWith(
      `customer:${CUSTOMER}`,
      expect.objectContaining({ event: "stamp.earned" }),
    );
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("the balance keeps accruing past the wallet size (no block, no completion)", async () => {
    repo.recordResult = {
      kind: "recorded",
      wallet: view({ currentStamps: 15 }),
      purchaseId: "p15",
    };
    const { service, realtime, enqueue } = build(repo);
    const { wallet } = await service.recordPurchase(ORG, STAFF, STORE, {
      customerId: CUSTOMER,
      priceCents: 1500,
      idempotencyKey: "idem-accrues",
    });
    // Balance can exceed WALLET_SIZE; the card never auto-completes.
    expect(wallet.currentStamps).toBe(15);
    expect(realtime.publish).toHaveBeenCalledWith(
      `customer:${CUSTOMER}`,
      expect.objectContaining({ event: "stamp.earned" }),
    );
    // Not the first stamp → the recap (router level) owns the notification.
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("is idempotent on retry — no duplicate stamp or notification", async () => {
    repo.recordResult = {
      kind: "idempotent",
      wallet: view({ currentStamps: 1 }),
      purchaseId: "p1",
    };
    const { service, realtime, enqueue } = build(repo);
    const { wallet } = await service.recordPurchase(ORG, STAFF, STORE, {
      customerId: CUSTOMER,
      priceCents: 1500,
      idempotencyKey: "idem-retry",
    });
    expect(wallet.currentStamps).toBe(1);
    expect(realtime.publish).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("threads inlineReward into the repo with redeemedByUserId = staff id", async () => {
    const { service } = build(repo);
    await service.recordPurchase(ORG, STAFF, STORE, {
      customerId: CUSTOMER,
      priceCents: 1500,
      idempotencyKey: "idem-inline-1",
      inlineReward: { rewardId: "rw_1", currency: "stamps" },
    });
    expect(repo.recordPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        inlineReward: {
          rewardId: "rw_1",
          currency: "stamps",
          redeemedByUserId: STAFF,
        },
      }),
    );
  });

  it("omits inlineReward when not provided", async () => {
    const { service } = build(repo);
    await service.recordPurchase(ORG, STAFF, STORE, {
      customerId: CUSTOMER,
      priceCents: 1500,
      idempotencyKey: "idem-inline-2",
    });
    expect(repo.recordPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ inlineReward: undefined }),
    );
  });
});
