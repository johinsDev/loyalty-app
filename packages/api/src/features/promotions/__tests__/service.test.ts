import type { PromoRow } from "@loyalty/db/schema";
import { describe, expect, it, vi } from "vitest";

import type { LocaleContext } from "../../_shared/localize";
import type { PromoRepository } from "../repository";
import { compileRule } from "../rule-compile";
import { PromoService } from "../service";

const lc: LocaleContext = {
  locale: "es",
  currency: "COP",
  defaultLocale: "es",
  defaultCurrency: "COP",
};

const publishedPromo = (over: Partial<PromoRow> = {}): PromoRow =>
  ({
    id: "promo-1",
    organizationId: "org-1",
    createdByUserId: "user-1",
    status: "published",
    name: "Promo",
    startsAt: null,
    endsAt: null,
    slug: "promo",
    type: "percentOff",
    rule: compileRule({ type: "percentOff", refs: [], percent: 10 }),
    schedule: null,
    conditions: {},
    audienceType: "all",
    tierKey: null,
    audienceCustomerIds: null,
    shortDescription: null,
    longDescription: null,
    badgeLabel: null,
    icon: null,
    backgroundCss: "#111",
    mainImageUrl: null,
    category: null,
    featured: false,
    sortOrder: 0,
    seoTitle: null,
    seoDescription: null,
    ogImageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: new Date(),
    ...over,
  }) as PromoRow;

function makeRepo(promos: PromoRow[], over: Partial<Record<string, unknown>> = {}) {
  return {
    publishedPromos: vi.fn(async () => promos),
    customerFacts: vi.fn(async () => ({
      tierKey: null,
      purchaseCount: 5,
      lastPurchaseAt: null,
    })),
    redemptionCounts: vi.fn(async () => new Map()),
    productCategories: vi.fn(async () => new Map([["prod-1", ["cat-1"]]])),
    modifierOptionDeltas: vi.fn(async () => new Map([["mod-1", 500]])),
    cardOf: vi.fn((row: PromoRow) => ({ id: row.id, name: row.name })),
    findById: vi.fn(async () => promos[0] ?? null),
    redemptionCount: vi.fn(async () => 0),
    remove: vi.fn(async () => {}),
    markArchived: vi.fn(async () => ({ ...publishedPromo(), status: "archived" })),
    markPublished: vi.fn(async () => publishedPromo()),
    ...over,
  } as unknown as PromoRepository;
}

const svc = (repo: PromoRepository) => new PromoService({} as never, repo);

describe("PromoService.applicable", () => {
  it("stitches categories + modifier deltas into the cart and evaluates", async () => {
    const promos = [
      publishedPromo({
        id: "cat-promo",
        rule: compileRule({
          type: "percentOff",
          refs: [{ kind: "category", id: "cat-1" }],
          percent: 20,
        }),
      }),
      publishedPromo({
        id: "mod-promo",
        slug: "mod",
        type: "crossSell",
        rule: compileRule({
          type: "crossSell",
          buy: [{ refs: [{ kind: "product", id: "prod-1" }], qty: 1 }],
          get: [{ refs: [{ kind: "modifierOption", id: "mod-1" }], qty: 1 }],
          percent: 100,
        }),
      }),
    ];
    const result = await svc(makeRepo(promos)).applicable(
      "org-1",
      "cust-1",
      {
        currency: "COP",
        lines: [{ productId: "prod-1", qty: 1, unitAmountCents: 10000, modifierOptionIds: ["mod-1"] }],
      },
      lc,
    );
    expect(result.applicable.map((a) => a.promo.id)).toEqual(["cat-promo", "mod-promo"]);
    const catPromo = result.applicable[0];
    expect(catPromo?.discountCents).toBe(2000); // 20% of the category line
    const modPromo = result.applicable[1];
    expect(modPromo?.discountCents).toBe(500); // free modifier at its delta
  });

  it("returns upsell hints for missing get-sides, sorted best-first applicable", async () => {
    const promos = [
      publishedPromo({
        id: "small",
        rule: compileRule({ type: "percentOff", refs: [], percent: 5 }),
      }),
      publishedPromo({
        id: "big",
        slug: "big",
        rule: compileRule({ type: "percentOff", refs: [], percent: 20 }),
      }),
      publishedPromo({
        id: "hint",
        slug: "hint",
        type: "crossSell",
        rule: compileRule({
          type: "crossSell",
          buy: [{ refs: [{ kind: "product", id: "prod-1" }], qty: 1 }],
          get: [{ refs: [{ kind: "product", id: "pad" }], qty: 1 }],
          percent: 50,
        }),
      }),
    ];
    const result = await svc(makeRepo(promos)).applicable(
      "org-1",
      "cust-1",
      { currency: "COP", lines: [{ productId: "prod-1", qty: 1, unitAmountCents: 10000 }] },
      lc,
    );
    expect(result.applicable.map((a) => a.promo.id)).toEqual(["big", "small"]);
    expect(result.hints).toHaveLength(1);
    expect(result.hints[0]?.missingGetSide).toEqual([{ kind: "product", id: "pad" }]);
  });
});

describe("PromoService lifecycle", () => {
  it("blocks deleting a promo with redemptions", async () => {
    const repo = makeRepo([publishedPromo()], { redemptionCount: vi.fn(async () => 3) });
    await expect(svc(repo).remove("org-1", "promo-1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  it("deletes a promo without redemptions", async () => {
    const repo = makeRepo([publishedPromo()]);
    await expect(svc(repo).remove("org-1", "promo-1")).resolves.toEqual({ ok: true });
  });

  it("blocks publishing an incomplete draft", async () => {
    const draft = publishedPromo({ status: "draft", rule: null });
    const repo = makeRepo([draft]);
    await expect(svc(repo).publish("org-1", "promo-1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  it("blocks advancing a published promo", async () => {
    const repo = makeRepo([publishedPromo()]);
    await expect(
      svc(repo).advance("org-1", "user-1", "promo-1", "essence", { name: "X", type: "nxm" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("blocks republishing an archived promo", async () => {
    const repo = makeRepo([publishedPromo({ status: "archived" })]);
    await expect(svc(repo).publish("org-1", "promo-1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });
});
