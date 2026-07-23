import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PurchasesRepository } from "../repository";
import type {
  PurchaseDetail,
  PurchaseListItem,
  PurchaseListView,
  UsualItem,
} from "../schemas";
import { PurchasesService } from "../service";

const ORG = "org_1";
const CUSTOMER = "cust_1";

function listItem(over: Partial<PurchaseListItem> = {}): PurchaseListItem {
  return {
    id: "p_1",
    createdAt: new Date("2026-06-01T10:00:00.000Z"),
    totalCents: 1000,
    subtotalCents: 1000,
    discountCents: 0,
    currency: "COP",
    itemSummary: null,
    itemCount: 0,
    stampsEarned: 1,
    pointsEarned: 0,
    hasPromo: false,
    hasReward: false,
    ...over,
  };
}

function detail(over: Partial<PurchaseDetail> = {}): PurchaseDetail {
  return {
    id: "p_1",
    createdAt: new Date("2026-06-01T10:00:00.000Z"),
    cashierName: "Ana",
    storeName: null,
    items: [],
    promo: null,
    reward: null,
    subtotalCents: 1000,
    discountCents: 0,
    totalCents: 1000,
    currency: "COP",
    stampsEarned: 1,
    pointsEarned: 0,
    ...over,
  };
}

class FakeRepo {
  myPurchasesResult: PurchaseListView = { items: [], nextCursor: null };
  detailResult: PurchaseDetail | null = detail();
  recentResult: PurchaseListItem[] = [];
  usualsResult: UsualItem[] = [];

  myPurchases = vi.fn(async () => this.myPurchasesResult);
  recentPurchases = vi.fn(async () => this.recentResult);
  purchaseDetail = vi.fn(async () => this.detailResult);
  usuals = vi.fn(async () => this.usualsResult);
}

function build(repo: FakeRepo) {
  return new PurchasesService(repo as unknown as PurchasesRepository);
}

describe("PurchasesService.myPurchases", () => {
  let repo: FakeRepo;
  beforeEach(() => {
    repo = new FakeRepo();
  });

  it("narrows ISO from/to to Date and forwards cursor + limit", async () => {
    repo.myPurchasesResult = {
      items: [listItem({ id: "a" }), listItem({ id: "b" })],
      nextCursor: "2026-06-01T09:00:00.000Z",
    };
    const service = build(repo);
    const res = await service.myPurchases(ORG, CUSTOMER, {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-30T00:00:00.000Z",
      cursor: "2026-06-02T00:00:00.000Z",
      limit: 20,
    });
    expect(res.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(res.nextCursor).toBe("2026-06-01T09:00:00.000Z");
    expect(repo.myPurchases).toHaveBeenCalledWith(ORG, CUSTOMER, {
      from: new Date("2026-06-01T00:00:00.000Z"),
      to: new Date("2026-06-30T00:00:00.000Z"),
      cursor: "2026-06-02T00:00:00.000Z",
      limit: 20,
    });
  });

  it("passes undefined dates when from/to absent", async () => {
    const service = build(repo);
    await service.myPurchases(ORG, CUSTOMER, { limit: 20 });
    expect(repo.myPurchases).toHaveBeenCalledWith(ORG, CUSTOMER, {
      from: undefined,
      to: undefined,
      cursor: undefined,
      limit: 20,
    });
  });
});

describe("PurchasesService.purchaseDetail", () => {
  let repo: FakeRepo;
  beforeEach(() => {
    repo = new FakeRepo();
  });

  it("returns the composed items branch", async () => {
    repo.detailResult = detail({
      items: [
        {
          id: "i1",
          productId: "prod_1",
          name: "Latte",
          slug: "latte",
          variantLabel: "Mediano",
          modifierLabels: ["Extra shot"],
          addonLabels: ["Perlas"],
          removedLabels: ["Azúcar"],
          qty: 2,
          unitAmountCents: 500,
        },
      ],
      subtotalCents: 1000,
      totalCents: 1000,
    });
    const res = await build(repo).purchaseDetail(ORG, CUSTOMER, "p_1");
    expect(res.items).toHaveLength(1);
    expect(res.items[0]).toMatchObject({
      name: "Latte",
      slug: "latte",
      variantLabel: "Mediano",
      modifierLabels: ["Extra shot"],
      qty: 2,
    });
    expect(res.promo).toBeNull();
    expect(res.reward).toBeNull();
  });

  it("returns the promo branch", async () => {
    repo.detailResult = detail({
      promo: {
        promoId: "promo_1",
        name: "2x1",
        slug: "dos-por-uno",
        discountCents: 500,
        freeItemLabel: "Latte",
      },
    });
    const res = await build(repo).purchaseDetail(ORG, CUSTOMER, "p_1");
    expect(res.promo).toMatchObject({
      name: "2x1",
      discountCents: 500,
      freeItemLabel: "Latte",
    });
  });

  it("returns the reward branch", async () => {
    repo.detailResult = detail({
      reward: {
        redemptionId: "red_1",
        rewardId: "rw_1",
        name: "Bebida gratis",
        imageUrl: "https://img/x.png",
        currency: "stamps",
        stampsSpent: 9,
        pointsSpent: 0,
      },
    });
    const res = await build(repo).purchaseDetail(ORG, CUSTOMER, "p_1");
    expect(res.reward).toMatchObject({
      name: "Bebida gratis",
      currency: "stamps",
      stampsSpent: 9,
    });
  });

  it("returns the amount-only branch (no items)", async () => {
    repo.detailResult = detail({ items: [], subtotalCents: null });
    const res = await build(repo).purchaseDetail(ORG, CUSTOMER, "p_1");
    expect(res.items).toEqual([]);
    expect(res.subtotalCents).toBeNull();
  });

  it("throws NOT_FOUND when the purchase isn't org+customer owned", async () => {
    repo.detailResult = null;
    await expect(
      build(repo).purchaseDetail(ORG, CUSTOMER, "nope"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" } satisfies Partial<TRPCError>);
    expect(repo.purchaseDetail).toHaveBeenCalledWith(ORG, CUSTOMER, "nope");
  });
});

describe("PurchasesService.recentPurchases", () => {
  it("forwards the limit and returns the rows", async () => {
    const repo = new FakeRepo();
    repo.recentResult = [listItem({ id: "r1" }), listItem({ id: "r2" })];
    const res = await build(repo).recentPurchases(ORG, CUSTOMER, { limit: 3 });
    expect(res.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(repo.recentPurchases).toHaveBeenCalledWith(ORG, CUSTOMER, 3);
  });
});

describe("PurchasesService.usuals", () => {
  it("forwards the limit and returns ordered usuals", async () => {
    const repo = new FakeRepo();
    repo.usualsResult = [
      { productId: "p1", name: "Latte", slug: "latte", imageUrl: null, orders: 5 },
      { productId: "p2", name: "Mocha", slug: "mocha", imageUrl: null, orders: 2 },
    ];
    const res = await build(repo).usuals(ORG, CUSTOMER, { limit: 4 });
    expect(res.map((u) => u.orders)).toEqual([5, 2]);
    expect(repo.usuals).toHaveBeenCalledWith(ORG, CUSTOMER, 4);
  });
});
