import type { RewardRow } from "@loyalty/db/schema";
import { describe, expect, it, vi } from "vitest";

import type { WizardContext } from "../../_shared/wizard";
import type { PromoRepository } from "../../promotions";
import type { RewardsRepository } from "../repository";
import type { RewardStepServices } from "../steps";
import { BenefitStep, DRAFT_NAME } from "../steps";
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
    services: {
      repo: { patch } as unknown as RewardsRepository,
      promoRepo: {
        // One eligible product: the catalog assertion passes unless a test
        // overrides it.
        variantAxes: async () => ({ pair: { eligibleCount: 1 } }),
      } as unknown as PromoRepository,
    },
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

describe("BenefitStep guards", () => {
  const upgrade = {
    type: "variantUpgrade" as const,
    refs: [],
    optionName: "Tamaño",
    fromValueLabel: "Mediano",
    toValueLabel: "Grande",
  };

  // Three labels matched against a per-product free-text vocabulary: without
  // this, a pair no product can satisfy persists and silently never applies.
  it("refuses an axis no product in scope can satisfy", async () => {
    const row = draft({ type: "variantUpgrade" });
    const { ctx } = makeCtx(row);
    (ctx.services.promoRepo as unknown as { variantAxes: () => Promise<unknown> }).variantAxes =
      async () => ({ pair: { eligibleCount: 0 } });
    await expect(
      rewardWizard.advance(ctx, row, "benefit", upgrade),
    ).rejects.toThrow(/upgrade-no-eligible-product/);
  });

  it("accepts partial coverage — one eligible product is enough", async () => {
    const row = draft({ type: "variantUpgrade" });
    const { ctx, patch } = makeCtx(row);
    await rewardWizard.advance(ctx, row, "benefit", upgrade);
    expect(patch).toHaveBeenCalled();
  });

  // The templates ship `{ type: "freeProduct", refs: [] }`, which the schema
  // rejects, and `createDraft` writes it without Zod. Presence alone let the
  // wizard skip the step and publish a reward matching ANY product.
  it("is not complete when the stored benefit doesn't parse", () => {
    const step = new BenefitStep();
    expect(step.isComplete(draft({ benefit: { type: "freeProduct", refs: [] } as never }))).toBe(
      false,
    );
    expect(
      step.isComplete(
        draft({ benefit: { type: "freeProduct", refs: [{ kind: "product", id: "p1" }] } as never }),
      ),
    ).toBe(true);
  });
});
