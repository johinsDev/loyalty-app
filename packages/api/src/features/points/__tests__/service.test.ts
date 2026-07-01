import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PointsAccountRow } from "@loyalty/db/schema";

import type { PointsRepository } from "../repository";
import { PointsService, pointsForPrice } from "../service";

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
