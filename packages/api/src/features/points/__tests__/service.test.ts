import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PointsAccountRow } from "@loyalty/db/schema";

import type { PointsRepository } from "../repository";
import { PointsService, pointsForPrice, spendToEarnPoints } from "../service";

const ORG = "org_1";
const STORE = "store_1";
const CUSTOMER = "cust_1";

/** In-memory stand-in for `PointsRepository`. */
class FakeRepo {
  earnInserted = true;
  balanceValue = 0;
  tierPointsValue = 0;
  accountRow: PointsAccountRow | undefined = undefined;

  earn = vi.fn(async () => this.earnInserted);
  balance = vi.fn(async () => this.balanceValue);
  tierPoints = vi.fn(async () => this.tierPointsValue);
  account = vi.fn(async () => this.accountRow);
  saveAccount = vi.fn(async () => undefined);
  history = vi.fn(async () => ({ rows: [], total: 0 }));
  customersForRecompute = vi.fn(async () => [CUSTOMER]);
}

function build(repo: FakeRepo) {
  const realtime = { publish: vi.fn(async () => undefined) };
  const enqueue = vi.fn(async () => undefined);
  const service = new PointsService(repo as unknown as PointsRepository, {
    realtime,
    enqueue,
  });
  return { service, realtime, enqueue };
}

describe("pointsForPrice", () => {
  it("earns EARN_POINTS per EARN_PER major units (100 COP → 4 pts)", () => {
    expect(pointsForPrice(1_500_000)).toBe(600); // 15.000 COP
    expect(pointsForPrice(100_000)).toBe(40); // 1.000 COP
    expect(pointsForPrice(5_000)).toBe(0); // 50 COP < rate floor
  });
});

describe("spendToEarnPoints", () => {
  const RATE = { per: 100, points: 4 }; // 100 COP → 4 pts

  it("returns the extra spend whose earn closes the points gap", () => {
    // Need 400 more pts → 100 blocks of 4 pts → 100 * 100 COP = 10.000 COP.
    // 10.000 COP = 1.000.000 cents earns exactly 400 pts.
    expect(spendToEarnPoints(200, 600, RATE)).toBe(1_000_000);
    expect(pointsForPrice(1_000_000, RATE)).toBe(400);
  });

  it("rounds up to the next whole earn block", () => {
    // Need 1 more pt but a block earns 4 → still one block = 100 COP.
    expect(spendToEarnPoints(599, 600, RATE)).toBe(10_000);
  });

  it("returns null when already affordable", () => {
    expect(spendToEarnPoints(600, 600, RATE)).toBeNull();
    expect(spendToEarnPoints(700, 600, RATE)).toBeNull();
  });

  it("returns null when the reward isn't point-priced", () => {
    expect(spendToEarnPoints(0, null, RATE)).toBeNull();
    expect(spendToEarnPoints(0, 0, RATE)).toBeNull();
  });

  it("returns null when the rate can't earn points", () => {
    expect(spendToEarnPoints(0, 600, { per: 0, points: 0 })).toBeNull();
  });
});

describe("PointsService.earnForPurchase", () => {
  let repo: FakeRepo;
  beforeEach(() => {
    repo = new FakeRepo();
  });

  it("inserts an earn, publishes points.earned, and recomputes", async () => {
    repo.tierPointsValue = 40;
    const { service, realtime } = build(repo);
    const res = await service.earnForPurchase(ORG, CUSTOMER, 100_000, "p1", STORE);
    expect(res.earned).toBe(40);
    expect(repo.earn).toHaveBeenCalled();
    expect(realtime.publish).toHaveBeenCalledWith(
      `customer:${CUSTOMER}`,
      expect.objectContaining({ event: "points.earned" }),
    );
  });

  it("is idempotent — a duplicate purchase earns nothing, no side effects", async () => {
    repo.earnInserted = false;
    const { service, realtime, enqueue } = build(repo);
    const res = await service.earnForPurchase(ORG, CUSTOMER, 100_000, "p1", STORE);
    expect(res.earned).toBe(0);
    expect(realtime.publish).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("earns 0 when the price is below the rate floor", async () => {
    const { service, realtime } = build(repo);
    const res = await service.earnForPurchase(ORG, CUSTOMER, 5_000, "p1", STORE);
    expect(res.earned).toBe(0);
    expect(repo.earn).not.toHaveBeenCalled();
    expect(realtime.publish).not.toHaveBeenCalled();
  });

  it("applies a promo points multiplier to the earn", async () => {
    const { service } = build(repo);
    const doubled = await service.earnForPurchase(ORG, CUSTOMER, 100_000, "p1", STORE, {
      multiplier: 2,
    });
    expect(doubled.earned).toBe(80); // 40 base × 2
    const half = await service.earnForPurchase(ORG, CUSTOMER, 100_000, "p2", STORE, {
      multiplier: 1.5,
    });
    expect(half.earned).toBe(60); // rounded
    const noop = await service.earnForPurchase(ORG, CUSTOMER, 100_000, "p3", STORE, {});
    expect(noop.earned).toBe(40);
  });
});

describe("PointsService.recompute", () => {
  let repo: FakeRepo;
  beforeEach(() => {
    repo = new FakeRepo();
  });

  it("enqueues tier-up + realtime when crossing a threshold", async () => {
    repo.tierPointsValue = 1200; // → oro
    repo.accountRow = {
      id: "a1",
      customerId: CUSTOMER,
      organizationId: ORG,
      currentTierKey: "hoja",
      nearNotifiedTierKey: null,
      updatedAt: new Date(),
    };
    const { service, realtime, enqueue } = build(repo);
    await service.recompute(ORG, CUSTOMER);
    expect(realtime.publish).toHaveBeenCalledWith(
      `customer:${CUSTOMER}`,
      expect.objectContaining({ event: "tier.changed" }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ notificationKey: "tier-up" }),
    );
    expect(repo.saveAccount).toHaveBeenCalled();
  });

  it("enqueues tier-down when points aged out", async () => {
    repo.tierPointsValue = 100; // → hoja
    repo.accountRow = {
      id: "a1",
      customerId: CUSTOMER,
      organizationId: ORG,
      currentTierKey: "oro",
      nearNotifiedTierKey: null,
      updatedAt: new Date(),
    };
    const { service, enqueue } = build(repo);
    await service.recompute(ORG, CUSTOMER);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ notificationKey: "tier-down" }),
    );
  });

  it("sends the near-threshold nudge once per tier", async () => {
    repo.tierPointsValue = 1100; // 83% to oro, tier flor
    repo.accountRow = {
      id: "a1",
      customerId: CUSTOMER,
      organizationId: ORG,
      currentTierKey: "flor",
      nearNotifiedTierKey: null,
      updatedAt: new Date(),
    };
    const { service, enqueue } = build(repo);
    await service.recompute(ORG, CUSTOMER);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ notificationKey: "tier-near" }),
    );

    // Already notified for oro → no repeat.
    enqueue.mockClear();
    repo.accountRow = { ...repo.accountRow, nearNotifiedTierKey: "oro" };
    await service.recompute(ORG, CUSTOMER);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("does not notify when first assigned to the base tier", async () => {
    repo.tierPointsValue = 0; // hoja, no account yet
    repo.accountRow = undefined;
    const { service, realtime, enqueue } = build(repo);
    await service.recompute(ORG, CUSTOMER);
    expect(realtime.publish).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
    expect(repo.saveAccount).toHaveBeenCalled(); // but the account is created
  });
});

describe("per-currency rate + loyalty gating (points config)", () => {
  let repo: FakeRepo;
  beforeEach(() => {
    repo = new FakeRepo();
  });

  it("pointsForPrice honors a custom per-currency rate", () => {
    // 1 USD (100 cents) → 4 pts at {per:1, points:4}
    expect(pointsForPrice(100, { per: 1, points: 4 })).toBe(4);
    // 4.99 USD floors to 4 major units → 16 pts
    expect(pointsForPrice(499, { per: 1, points: 4 })).toBe(16);
    // below `per` major units → 0 (same floor semantics as ever)
    expect(pointsForPrice(50_000, { per: 1_000, points: 10 })).toBe(0);
  });

  it("earns 0 (no row, no side effects) when the org paused points", async () => {
    const { service, realtime } = build(repo);
    const res = await service.earnForPurchase(ORG, CUSTOMER, 100_000, "p1", STORE, {
      loyalty: { enabled: false, rate: { per: 100, points: 4 } },
    });
    expect(res.earned).toBe(0);
    expect(repo.earn).not.toHaveBeenCalled();
    expect(realtime.publish).not.toHaveBeenCalled();
  });

  it("earns with the purchase currency's rate when provided", async () => {
    const { service } = build(repo);
    // 5 USD at {per:1, points:4} → 20 pts (the COP default would give 0).
    const res = await service.earnForPurchase(ORG, CUSTOMER, 500, "p1", STORE, {
      loyalty: { enabled: true, rate: { per: 1, points: 4 } },
    });
    expect(res.earned).toBe(20);
  });

  it("recompute with noDowngrade keeps a higher stored tier (grace)", async () => {
    repo.tierPointsValue = 100; // window says hoja…
    repo.accountRow = {
      id: "a1",
      customerId: CUSTOMER,
      organizationId: ORG,
      currentTierKey: "oro", // …but the customer froze at oro
      nearNotifiedTierKey: null,
      updatedAt: new Date(),
    };
    const { service, enqueue } = build(repo);
    const res = await service.recompute(ORG, CUSTOMER, { noDowngrade: true });
    expect(res).toBeNull();
    expect(repo.saveAccount).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("recompute with noDowngrade still allows an upgrade", async () => {
    repo.tierPointsValue = 1200; // → oro
    repo.accountRow = {
      id: "a1",
      customerId: CUSTOMER,
      organizationId: ORG,
      currentTierKey: "hoja",
      nearNotifiedTierKey: null,
      updatedAt: new Date(),
    };
    const { service, enqueue } = build(repo);
    const res = await service.recompute(ORG, CUSTOMER, { noDowngrade: true });
    expect(res?.tierName).toBeTruthy();
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ notificationKey: "tier-up" }),
    );
  });
});
