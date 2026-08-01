import type { PromoRow } from "@loyalty/db/schema";
import { describe, expect, it, vi } from "vitest";

import type { LocaleContext } from "../../_shared/localize";
import { benefitSummary } from "../format";
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
    addonDeltas: vi.fn(async () => new Map<string, number>()),
    // Resolves the rule's refs so a card can say WHICH products it covers.
    refNames: vi.fn(async () => new Map<string, string>()),
    // Runs the real summary formatter, so the `names` the service resolves are
    // actually consumed. A stub that ignored them made every test about naming
    // — and about the cache that carries the names — pass vacuously.
    cardOf: vi.fn((row: PromoRow, _ctx: LocaleContext, names?: ReadonlyMap<string, string>) => ({
      id: row.id,
      name: row.name,
      benefitSummary: benefitSummary(row.type, row.rule, "es", names),
    })),
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
  it("survives a second call — the cached ref names come back as data, not a Map", async () => {
    // The cache serializes what it stores, so a Map returns as a plain object
    // and every `.get` throws on the HIT. That took the whole register preview
    // down while it kept showing the previous cart's numbers, and only on the
    // SECOND evaluation — which is why one call passing proves nothing.
    const promos = [
      publishedPromo({
        id: "named-promo",
        rule: compileRule({
          type: "percentOff",
          refs: [{ kind: "category", id: "cat-1" }],
          percent: 20,
        }),
      }),
    ];
    const repo = makeRepo(promos, {
      refNames: vi.fn(async () => new Map([["cat-1", "Frutales"]])),
    });
    const service = svc(repo);
    const cart = {
      currency: "COP",
      lines: [{ productId: "prod-1", qty: 1, unitAmountCents: 10000 }],
    };
    const first = await service.applicable("org-cache", "cust-1", cart, lc);
    const second = await service.applicable("org-cache", "cust-1", cart, lc);
    // Not just "it didn't throw": the name has to survive the round trip, or
    // the register quietly falls back to "en productos seleccionados".
    expect(first.applicable[0]?.promo.benefitSummary).toBe("20% en Frutales");
    expect(second.applicable[0]?.promo.benefitSummary).toBe("20% en Frutales");
  });

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
