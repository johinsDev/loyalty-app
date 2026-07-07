import type { PromoRow } from "@loyalty/db/schema";
import { describe, expect, it, vi } from "vitest";

import type { WizardContext } from "../../_shared/wizard";
import type { PromoRepository } from "../repository";
import { compileRule } from "../rule-compile";
import type { PromoStepServices } from "../steps";
import { promoWizard } from "../wizard";

const baseDraft = (over: Partial<PromoRow> = {}): PromoRow =>
  ({
    id: "promo-1",
    organizationId: "org-1",
    createdByUserId: "user-1",
    status: "draft",
    name: null,
    startsAt: null,
    endsAt: null,
    slug: "borrador-abc123",
    type: null,
    rule: null,
    schedule: null,
    conditions: null,
    audienceType: "all",
    tierKey: null,
    audienceCustomerIds: null,
    shortDescription: null,
    longDescription: null,
    badgeLabel: null,
    icon: null,
    backgroundCss: null,
    mainImageUrl: null,
    category: null,
    featured: false,
    sortOrder: 0,
    seoTitle: null,
    seoDescription: null,
    ogImageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
    ...over,
  }) as PromoRow;

function makeCtx(draft: PromoRow) {
  const patch = vi.fn(async (_org: string, _id: string, p: Record<string, unknown>) => ({
    ...draft,
    ...p,
  }));
  const repo = {
    patch,
    uniqueSlug: vi.fn(async (_org: string, name: string) => name.toLowerCase().replace(/\s+/g, "-")),
  } as unknown as PromoRepository;
  const ctx: WizardContext<PromoStepServices> = {
    db: {} as never,
    organizationId: "org-1",
    userId: "user-1",
    services: { repo },
  };
  return { ctx, patch };
}

describe("promoWizard state", () => {
  it("derives current from completeness in step order", () => {
    expect(promoWizard.state(baseDraft()).current).toBe("essence");
    const named = baseDraft({ name: "Promo", type: "percentOff" });
    expect(promoWizard.state(named).current).toBe("benefit");
    const withRule = baseDraft({
      name: "Promo",
      type: "percentOff",
      rule: compileRule({ type: "percentOff", refs: [], percent: 10 }),
    });
    expect(promoWizard.state(withRule).current).toBe("conditions");
    const withConditions = baseDraft({ ...withRule, conditions: {} });
    expect(promoWizard.state(withConditions).current).toBe("design");
    const complete = baseDraft({ ...withConditions, backgroundCss: "#111" });
    const state = promoWizard.state(complete);
    expect(state.current).toBe("review");
    expect(state.canPublish).toBe(true);
    expect(state.order).toEqual(["essence", "benefit", "conditions", "design"]);
  });

  it("gates benefit behind type and conditions behind rule", () => {
    const empty = baseDraft();
    expect(promoWizard.step("benefit").canEnter(empty)).toBe(false);
    expect(promoWizard.step("conditions").canEnter(empty)).toBe(false);
  });
});

describe("promoWizard advance", () => {
  it("persists essence and resets the rule when the type changes", async () => {
    const draft = baseDraft({
      name: "Old",
      type: "percentOff",
      slug: "old",
      rule: compileRule({ type: "percentOff", refs: [], percent: 10 }),
    });
    const { ctx, patch } = makeCtx(draft);
    await promoWizard.advance(ctx, draft, "essence", { name: "New", type: "nxm" });
    expect(patch).toHaveBeenCalledWith(
      "org-1",
      "promo-1",
      expect.objectContaining({ name: "New", type: "nxm", rule: null }),
    );
  });

  it("keeps the rule when the type is unchanged", async () => {
    const draft = baseDraft({
      name: "Old",
      type: "percentOff",
      slug: "old",
      rule: compileRule({ type: "percentOff", refs: [], percent: 10 }),
    });
    const { ctx, patch } = makeCtx(draft);
    await promoWizard.advance(ctx, draft, "essence", { name: "New", type: "percentOff" });
    const arg = patch.mock.calls[0]?.[2] as Record<string, unknown>;
    expect("rule" in arg).toBe(false);
  });

  it("compiles the benefit config into the rule and rejects type mismatches", async () => {
    const draft = baseDraft({ name: "P", type: "nxm" });
    const { ctx, patch } = makeCtx(draft);
    await promoWizard.advance(ctx, draft, "benefit", {
      type: "nxm",
      refs: [],
      buyQty: 2,
      payQty: 1,
    });
    expect(patch).toHaveBeenCalledWith(
      "org-1",
      "promo-1",
      expect.objectContaining({
        rule: compileRule({ type: "nxm", refs: [], buyQty: 2, payQty: 1 }),
      }),
    );

    await expect(
      promoWizard.advance(ctx, draft, "benefit", { type: "percentOff", refs: [], percent: 10 }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("rejects invalid step input with BAD_REQUEST", async () => {
    const draft = baseDraft();
    const { ctx } = makeCtx(draft);
    await expect(
      promoWizard.advance(ctx, draft, "essence", { name: "", type: "percentOff" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("persists conditions with audience normalization", async () => {
    const draft = baseDraft({
      name: "P",
      type: "percentOff",
      rule: compileRule({ type: "percentOff", refs: [], percent: 10 }),
    });
    const { ctx, patch } = makeCtx(draft);
    await promoWizard.advance(ctx, draft, "conditions", {
      conditions: { maxPerCustomer: 2 },
      audienceType: "all",
      tierKey: "oro", // ignored: audience is "all"
    });
    expect(patch).toHaveBeenCalledWith(
      "org-1",
      "promo-1",
      expect.objectContaining({
        conditions: { maxPerCustomer: 2 },
        audienceType: "all",
        tierKey: null,
        audienceCustomerIds: null,
      }),
    );

    await expect(
      promoWizard.advance(ctx, draft, "conditions", {
        conditions: {},
        audienceType: "tier",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
