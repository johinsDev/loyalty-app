import { describe, expect, it, vi } from "vitest";

import type { PointsRepository } from "../repository";
import { PointsService } from "../service";
import { classifyTransaction } from "../transactions";

const ORG = "org_1";
const CUSTOMER = "cust_1";

describe("classifyTransaction", () => {
  it("maps an earn with no reason / 'purchase' to kind 'purchase'", () => {
    expect(classifyTransaction("earn", null)).toEqual({
      kind: "purchase",
      rewardId: null,
    });
    expect(classifyTransaction("earn", "purchase")).toEqual({
      kind: "purchase",
      rewardId: null,
    });
  });

  it("extracts the reward id from a redeem 'reward:<id>' reason", () => {
    expect(classifyTransaction("redeem", "reward:abc-123")).toEqual({
      kind: "reward",
      rewardId: "abc-123",
    });
  });

  it("classifies an adjust row", () => {
    expect(classifyTransaction("adjust", "manual fix")).toEqual({
      kind: "adjust",
      rewardId: null,
    });
  });

  it("falls back to 'other' for a redeem without a reward reason", () => {
    expect(classifyTransaction("redeem", "manual")).toEqual({
      kind: "other",
      rewardId: null,
    });
  });
});

describe("PointsService.myTransactions", () => {
  function buildService(transactions: {
    items: Awaited<ReturnType<PointsRepository["transactions"]>>["items"];
    nextCursor: string | null;
  }) {
    const repo = {
      transactions: vi.fn(async () => transactions),
    } as unknown as PointsRepository;
    return { service: new PointsService(repo), repo };
  }

  it("resolves a reward name for a redeem and never leaks the raw reason", async () => {
    const createdAt = new Date("2026-06-01T12:00:00.000Z");
    const { service } = buildService({
      items: [
        {
          id: "t1",
          type: "redeem",
          points: -80,
          createdAt,
          kind: "reward",
          rewardName: "Té gratis",
          priceCents: null,
        },
        {
          id: "t2",
          type: "earn",
          points: 40,
          createdAt,
          kind: "purchase",
          rewardName: null,
          priceCents: 1000,
        },
      ],
      nextCursor: null,
    });

    const res = await service.myTransactions(ORG, CUSTOMER, { limit: 20 });
    expect(res.items[0]).toMatchObject({
      kind: "reward",
      rewardName: "Té gratis",
      points: -80,
    });
    expect(res.items[1]).toMatchObject({ kind: "purchase", rewardName: null });
    // No raw `reward:<id>` reason field on the wire shape.
    expect(res.items[0]).not.toHaveProperty("reason");
  });

  it("passes the date range + cursor through and returns nextCursor", async () => {
    const { service, repo } = buildService({
      items: [],
      nextCursor: "2026-06-01T00:00:00.000Z",
    });
    const res = await service.myTransactions(ORG, CUSTOMER, {
      from: "2026-05-01T00:00:00.000Z",
      to: "2026-06-30T23:59:59.999Z",
      cursor: "2026-06-02T00:00:00.000Z",
      limit: 10,
    });
    expect(res.nextCursor).toBe("2026-06-01T00:00:00.000Z");
    expect(repo.transactions).toHaveBeenCalledWith(ORG, CUSTOMER, {
      from: new Date("2026-05-01T00:00:00.000Z"),
      to: new Date("2026-06-30T23:59:59.999Z"),
      cursor: "2026-06-02T00:00:00.000Z",
      limit: 10,
    });
  });
});
