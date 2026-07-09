import type { RewardRow } from "@loyalty/db/schema";
import { describe, expect, it, vi } from "vitest";

import type { WizardContext } from "../../_shared/wizard";
import type { RewardsRepository } from "../repository";
import type { RewardStepServices } from "../steps";
import { DRAFT_NAME } from "../steps";
import { rewardWizard } from "../wizard";

const draft = (over: Partial<RewardRow> = {}): RewardRow =>
  ({
    id: "rw-1",
    organizationId: "org-1",
    createdByUserId: "u-1",
    status: "draft",
    name: DRAFT_NAME,
    description: null,
    imageUrl: null,
    type: null,
    benefit: null,
    fulfillmentNote: null,
    backgroundCss: null,
    icon: null,
    stampsRequired: null,
    pointsCost: null,
    costMode: "or",
    allowedTiers: null,
    sections: [],
    sortOrder: 0,
    limitPerCustomer: "unlimited",
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
    ...over,
  }) as RewardRow;

function makeCtx(row: RewardRow) {
  const patch = vi.fn(async (_o: string, _id: string, p: Record<string, unknown>) => ({
    ...row,
    ...p,
  }));
  const ctx: WizardContext<RewardStepServices> = {
    db: {} as never,
    organizationId: "org-1",
    userId: "u-1",
    services: { repo: { patch } as unknown as RewardsRepository },
  };
  return { ctx, patch };
}

describe("rewardWizard state", () => {
  it("derives current from completeness in order", () => {
    expect(rewardWizard.state(draft()).current).toBe("essence");
    const named = draft({ name: "Bebida gratis", type: "freeProduct" });
    expect(rewardWizard.state(named).current).toBe("benefit");
    const withBenefit = draft({ ...named, benefit: { type: "freeProduct", refs: [{ kind: "product", id: "p" }] } });
    expect(rewardWizard.state(withBenefit).current).toBe("cost");
    const withCost = draft({ ...withBenefit, stampsRequired: 10 });
    expect(rewardWizard.state(withCost).current).toBe("design");
    const complete = draft({ ...withCost, backgroundCss: "#111" });
    const s = rewardWizard.state(complete);
    expect(s.current).toBe("review");
    expect(s.canPublish).toBe(true);
    expect(s.order).toEqual(["essence", "benefit", "cost", "design"]);
  });

  it("the placeholder draft name doesn't count as complete essence", () => {
    expect(rewardWizard.state(draft({ type: "freeProduct" })).current).toBe("essence");
  });
});

describe("rewardWizard advance", () => {
  it("essence resets the benefit when the type changes", async () => {
    const row = draft({
      name: "Old",
      type: "freeProduct",
      benefit: { type: "freeProduct", refs: [{ kind: "product", id: "p" }] },
    });
    const { ctx, patch } = makeCtx(row);
    await rewardWizard.advance(ctx, row, "essence", { name: "New", type: "amountOff" });
    expect(patch).toHaveBeenCalledWith(
      "org-1",
      "rw-1",
      expect.objectContaining({ type: "amountOff", benefit: null }),
    );
  });

  it("benefit rejects a config type that doesn't match", async () => {
    const row = draft({ name: "R", type: "freeProduct" });
    const { ctx } = makeCtx(row);
    await expect(
      rewardWizard.advance(ctx, row, "benefit", { type: "amountOff", amountCents: 500000, refs: [] }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("cost step rejects when no currency is set", async () => {
    const row = draft({ name: "R", type: "freeProduct", benefit: { type: "freeProduct", refs: [{ kind: "product", id: "p" }] } });
    const { ctx } = makeCtx(row);
    await expect(
      rewardWizard.advance(ctx, row, "cost", {
        costMode: "or",
        limitPerCustomer: "unlimited",
        sections: [],
        sortOrder: 0,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
