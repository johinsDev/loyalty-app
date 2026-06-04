import type { PromoRow } from "@loyalty/db/schema";
import { describe, expect, it } from "vitest";

import type { PromoRepository } from "../repository";
import { PromoService } from "../service";

function makeRow(over: Partial<PromoRow> = {}): PromoRow {
  const now = new Date();
  return {
    id: "promo_1",
    organizationId: "org_1",
    createdByUserId: "user_1",
    status: "draft",
    name: null,
    segmentId: null,
    productIds: null,
    branding: null,
    startsAt: null,
    endsAt: null,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    ...over,
  };
}

/** In-memory stand-in for `PromoRepository` — one evolving row. */
class FakeRepo {
  row: PromoRow = makeRow();
  createDraft() {
    this.row = makeRow();
    return Promise.resolve(this.row);
  }
  findById(_org: string, id: string) {
    return Promise.resolve(id === this.row.id ? this.row : null);
  }
  patch(_org: string, _id: string, patch: Partial<PromoRow>) {
    this.row = { ...this.row, ...patch, updatedAt: new Date() };
    return Promise.resolve(this.row);
  }
  markPublished() {
    this.row = { ...this.row, status: "published", publishedAt: new Date() };
    return Promise.resolve(this.row);
  }
}

function service() {
  const repo = new FakeRepo();
  return new PromoService(
    {} as never,
    repo as unknown as PromoRepository,
  );
}

const ORG = "org_1";
const USER = "user_1";

async function advanceAll(svc: PromoService, id: string) {
  await svc.advance(ORG, USER, id, "segment", {
    name: "Summer sale",
    segmentId: "seg_1",
  });
  await svc.advance(ORG, USER, id, "products", { productIds: ["p1", "p2"] });
  await svc.advance(ORG, USER, id, "branding", {
    icon: "tag",
    color: "#16a34a",
  });
  return svc.advance(ORG, USER, id, "schedule", {
    startsAt: new Date("2026-07-01"),
    endsAt: new Date("2026-07-31"),
  });
}

describe("PromoService", () => {
  it("creates a draft sitting on the first step", async () => {
    const { promo, state } = await service().create(ORG, USER);
    expect(promo.status).toBe("draft");
    expect(state.current).toBe("segment");
    expect(state.canPublish).toBe(false);
  });

  it("walks every step then publishes", async () => {
    const svc = service();
    const { promo } = await svc.create(ORG, USER);
    const { state } = await advanceAll(svc, promo.id);
    expect(state.current).toBe("review");
    expect(state.canPublish).toBe(true);

    const published = await svc.publish(ORG, promo.id);
    expect(published.promo.status).toBe("published");
    expect(published.promo.publishedAt).not.toBeNull();
  });

  it("refuses to publish an incomplete draft", async () => {
    const svc = service();
    const { promo } = await svc.create(ORG, USER);
    await svc.advance(ORG, USER, promo.id, "segment", {
      name: "x",
      segmentId: "seg_1",
    });
    await expect(svc.publish(ORG, promo.id)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  it("gates a step behind its prerequisite", async () => {
    const svc = service();
    const { promo } = await svc.create(ORG, USER);
    await expect(
      svc.advance(ORG, USER, promo.id, "products", { productIds: ["p1"] }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("rejects invalid step input with BAD_REQUEST", async () => {
    const svc = service();
    const { promo } = await svc.create(ORG, USER);
    await expect(
      svc.advance(ORG, USER, promo.id, "segment", { name: "", segmentId: "" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("404s an unknown draft", async () => {
    await expect(service().getState(ORG, "nope")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
