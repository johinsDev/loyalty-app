import { describe, expect, it } from "vitest";

import { emptyProductDraft, type ProductDraft } from "../../data";
import { detailToDraft, draftToUpsert } from "../map";

// A minimal API detail shaped like menu.getAdmin's output.
const detail = {
  id: "p1",
  name: "Taro",
  slug: "taro",
  description: null,
  status: "active",
  basePriceCents: 6500,
  currency: "COP",
  brand: null,
  gender: null,
  ageRange: null,
  mpn: null,
  stockMode: "infinite",
  stockQty: null,
  productType: "physical",
  sortOrder: 0,
  seoTitle: null,
  seoDescription: null,
  ogImageUrl: null,
  categoryIds: ["c1"],
  options: [
    { id: "o1", name: "Tamaño", sortOrder: 0, values: [
      { id: "o1::regular", label: "Regular", sortOrder: 0 },
      { id: "o1::grande", label: "Grande", sortOrder: 1 },
    ] },
  ],
  variants: [
    { id: "var::o1::regular", sku: null, priceCents: 6500, isDefault: true, sortOrder: 0, optionValueIds: ["o1::regular"] },
    { id: "var::o1::grande", sku: null, priceCents: 7500, isDefault: false, sortOrder: 1, optionValueIds: ["o1::grande"] },
  ],
  modifierGroups: [
    { id: "g1", name: "Toppings", selectionType: "multi", minSelect: 0, maxSelect: null, required: false, sortOrder: 0,
      options: [{ id: "m1", name: "Boba", priceDeltaCents: 800, pointsDelta: null, sortOrder: 0 }] },
  ],
  images: [{ id: "img1", url: "https://x/a.jpg", alt: null, variantId: null, sortOrder: 0 }],
} as unknown as Parameters<typeof detailToDraft>[0];

describe("product editor map (round-trip id stability)", () => {
  it("detailToDraft rebuilds label combos + major-unit prices", () => {
    const { draft, status } = detailToDraft(detail);
    expect(status).toBe("active");
    expect(draft.price).toBe(65); // 6500 cents → major units
    expect(draft.options[0]!.values).toEqual(["Regular", "Grande"]);
    expect(draft.variants[1]!.combo).toEqual(["Grande"]);
    expect(draft.variants[1]!.price).toBe(75);
  });

  it("draft→upsert keeps the SAME variant + value ids (promo/reward refs survive)", () => {
    const { draft, status, passthrough } = detailToDraft(detail);
    const out = draftToUpsert("p1", draft, status, passthrough);
    expect(out.variants.map((v) => v.id)).toEqual(["var::o1::regular", "var::o1::grande"]);
    expect(out.options[0]!.values.map((v) => v.id)).toEqual(["o1::regular", "o1::grande"]);
    // modifiers + images round-trip untouched (editor doesn't manage them yet).
    expect(out.modifierGroups[0]!.options[0]!.id).toBe("m1");
    expect(out.images[0]!.id).toBe("img1");
  });

  it("editing a variant price does not change its id", () => {
    const { draft, status, passthrough } = detailToDraft(detail);
    const edited: ProductDraft = {
      ...draft,
      variants: draft.variants.map((v) => (v.combo[0] === "Regular" ? { ...v, price: 70 } : v)),
    };
    const out = draftToUpsert("p1", edited, status, passthrough);
    const reg = out.variants.find((v) => v.id === "var::o1::regular");
    expect(reg?.priceCents).toBe(7000); // updated
    expect(reg?.id).toBe("var::o1::regular"); // id preserved
  });

  it("a fresh draft with no options yields no variants", () => {
    const out = draftToUpsert("p2", { ...emptyProductDraft, name: "Plain", price: 5 }, "draft", {
      modifierGroups: [],
      images: [],
    });
    expect(out.variants).toEqual([]);
    expect(out.basePriceCents).toBe(500);
  });
});
