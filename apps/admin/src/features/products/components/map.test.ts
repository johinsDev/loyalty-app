import type { AppRouter } from "@loyalty/api";
import type { inferRouterOutputs } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { emptyProductDraft, type ProductDraft } from "../data";
import { detailToDraft, draftToUpsert, removeMediaFromDraft } from "./map";

type AdminDetail = NonNullable<inferRouterOutputs<AppRouter>["menu"]["getAdmin"]>;
type AdminImage = AdminDetail["images"][number];
type AdminVariant = AdminDetail["variants"][number];

/** A product with one "Tamaño" option (Mediano / Grande) and a variant each. */
function makeDetail(overrides: Partial<AdminDetail> = {}): AdminDetail {
  const detail = {
    id: "p1",
    name: "Matcha Strawberry",
    slug: "matcha-strawberry",
    description: null,
    status: "active",
    basePriceCents: 7000,
    promoPriceCents: null,
    currency: "COP",
    brand: null,
    gender: null,
    ageRange: null,
    mpn: null,
    stockMode: "infinite",
    stockQty: null,
    productType: "physical",
    recipeNotes: null,
    sortOrder: 0,
    seoTitle: null,
    seoDescription: null,
    ogImageUrl: null,
    categoryIds: [],
    primaryCategoryId: null,
    storeIds: null,
    options: [
      {
        id: "o_size",
        name: "Tamaño",
        sortOrder: 0,
        values: [
          { id: "o_size::mediano", label: "Mediano", sortOrder: 0 },
          { id: "o_size::grande", label: "Grande", sortOrder: 1 },
        ],
      },
    ],
    variants: [
      makeVariant({ id: "var::o_size::mediano", optionValueIds: ["o_size::mediano"] }),
      makeVariant({
        id: "var::o_size::grande",
        optionValueIds: ["o_size::grande"],
        priceCents: 9000,
        sortOrder: 1,
        isDefault: false,
      }),
    ],
    modifierGroups: [],
    addonGroups: [],
    images: [],
  } satisfies AdminDetail;
  return { ...detail, ...overrides };
}

function makeVariant(overrides: Partial<AdminVariant> & { id: string }): AdminVariant {
  return {
    sku: null,
    priceCents: 7000,
    promoPriceCents: null,
    isDefault: true,
    sortOrder: 0,
    optionValueIds: [],
    ingredients: [],
    costCents: 0,
    marginPct: null,
    ...overrides,
  };
}

function makeImage(overrides: Partial<AdminImage> & { id: string; url: string }): AdminImage {
  return { alt: null, variantId: null, sortOrder: 0, ...overrides };
}

/** A draft with two photos and two variants (no image picked). */
function makeDraft(overrides: Partial<ProductDraft> = {}): ProductDraft {
  return {
    ...emptyProductDraft,
    name: "Matcha Strawberry",
    currency: "COP",
    price: 70,
    media: [
      { id: "m1", emoji: "", url: "https://cdn/main.png" },
      { id: "m2", emoji: "", url: "https://cdn/second.png" },
    ],
    options: [{ id: "o_size", name: "Tamaño", values: ["Mediano", "Grande"] }],
    variants: [
      { id: "v1", combo: ["Mediano"], price: 70, promoPrice: null, sku: "", stock: null, image: null, ingredients: [] },
      { id: "v2", combo: ["Grande"], price: 90, promoPrice: null, sku: "", stock: null, image: null, ingredients: [] },
    ],
    ...overrides,
  };
}

const upsert = (draft: ProductDraft) =>
  draftToUpsert("p1", draft, "active", { modifierGroups: [] });

describe("detailToDraft — variant image", () => {
  it("points the variant at the product photo with the same url", () => {
    const { draft } = detailToDraft(
      makeDetail({
        images: [
          makeImage({ id: "img_main", url: "https://cdn/main.png" }),
          makeImage({ id: "img_second", url: "https://cdn/second.png", sortOrder: 1 }),
          makeImage({
            id: "img_v_grande",
            url: "https://cdn/second.png",
            variantId: "var::o_size::grande",
            sortOrder: 2,
          }),
        ],
      }),
    );

    expect(draft.media.map((m) => m.id)).toEqual(["img_main", "img_second"]);
    expect(draft.variants[0]?.image).toBeNull();
    expect(draft.variants[1]?.image).toBe("img_second");
  });

  it("surfaces a variant-only image as a product photo, appended after the main one", () => {
    const { draft } = detailToDraft(
      makeDetail({
        images: [
          makeImage({ id: "img_main", url: "https://cdn/main.png" }),
          makeImage({
            id: "img_v_grande",
            url: "https://cdn/only-grande.png",
            variantId: "var::o_size::grande",
            sortOrder: 1,
          }),
        ],
      }),
    );

    expect(draft.media).toHaveLength(2);
    expect(draft.media[0]?.id).toBe("img_main");
    expect(draft.media[1]).toEqual({
      id: "img_v_grande",
      emoji: "",
      url: "https://cdn/only-grande.png",
    });
    expect(draft.variants[1]?.image).toBe("img_v_grande");
  });

  it("leaves the image null when the variant has none", () => {
    const { draft } = detailToDraft(
      makeDetail({ images: [makeImage({ id: "img_main", url: "https://cdn/main.png" })] }),
    );

    expect(draft.variants.map((v) => v.image)).toEqual([null, null]);
  });
});

describe("draftToUpsert — variant image", () => {
  it("emits one product-level row per photo plus one scoped row per variant", () => {
    const draft = makeDraft();
    draft.variants[0]!.image = "m1";
    draft.variants[1]!.image = "m2";

    const { images } = upsert(draft);

    expect(images.filter((i) => i.variantId == null).map((i) => i.url)).toEqual([
      "https://cdn/main.png",
      "https://cdn/second.png",
    ]);
    expect(
      images
        .filter((i) => i.variantId != null)
        .map((i) => ({ variantId: i.variantId, url: i.url })),
    ).toEqual([
      { variantId: "var::o_size::mediano", url: "https://cdn/main.png" },
      { variantId: "var::o_size::grande", url: "https://cdn/second.png" },
    ]);
  });

  it("derives stable row ids so a re-save updates instead of duplicating", () => {
    const draft = makeDraft();
    draft.variants[1]!.image = "m2";

    expect(upsert(draft).images.map((i) => i.id)).toEqual(upsert(draft).images.map((i) => i.id));
    expect(upsert(draft).images.find((i) => i.variantId != null)?.id).toBe(
      "var::o_size::grande::img",
    );
  });

  it("emits no scoped row when the variant image was unlinked", () => {
    const draft = makeDraft();
    draft.variants[0]!.image = "m1";

    const { images } = upsert(draft);

    expect(images.filter((i) => i.variantId === "var::o_size::grande")).toEqual([]);
  });

  it("skips an emoji-only selection (there is no url to store)", () => {
    const draft = makeDraft({
      media: [
        { id: "m1", emoji: "", url: "https://cdn/main.png" },
        { id: "m_emoji", emoji: "🧋" },
      ],
    });
    draft.variants[1]!.image = "m_emoji";

    const { images } = upsert(draft);

    expect(images.filter((i) => i.variantId != null)).toEqual([]);
    expect(images).toHaveLength(1);
  });

  it("round-trips the variant → url pairs through detailToDraft", () => {
    const detail = makeDetail({
      images: [
        makeImage({ id: "img_main", url: "https://cdn/main.png" }),
        makeImage({
          id: "img_v_grande",
          url: "https://cdn/only-grande.png",
          variantId: "var::o_size::grande",
          sortOrder: 1,
        }),
      ],
    });
    const { draft, status, passthrough } = detailToDraft(detail);

    const { images } = draftToUpsert(detail.id, draft, status, passthrough);

    expect(
      images
        .filter((i) => i.variantId != null)
        .map((i) => ({ variantId: i.variantId, url: i.url })),
    ).toEqual([{ variantId: "var::o_size::grande", url: "https://cdn/only-grande.png" }]);
  });
});

describe("removeMediaFromDraft", () => {
  it("drops the photo and unlinks only the variants that used it", () => {
    const draft = makeDraft();
    draft.variants[0]!.image = "m1";
    draft.variants[1]!.image = "m2";

    const next = removeMediaFromDraft(draft, "m1");

    expect(next.media.map((m) => m.id)).toEqual(["m2"]);
    expect(next.variants[0]?.image).toBeNull();
    expect(next.variants[1]?.image).toBe("m2");
  });

  it("leaves the draft alone when the id isn't there", () => {
    const draft = makeDraft();

    const next = removeMediaFromDraft(draft, "nope");

    expect(next.media).toEqual(draft.media);
    expect(next.variants).toEqual(draft.variants);
  });
});
