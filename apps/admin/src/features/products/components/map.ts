import type { AppRouter } from "@loyalty/api";
import type { ProductUpsertInput } from "@loyalty/api/features/products/write-schemas";
import type { inferRouterOutputs } from "@trpc/server";

import type { ProductDraft, ProductStatus } from "../data";

type AdminDetail = NonNullable<inferRouterOutputs<AppRouter>["menu"]["getAdmin"]>;

/** Deterministic ids so unchanged options/values/variants keep their id across
 *  saves (the backend diffs by id → promo/reward refs to variant/modifierOption
 *  ids stay valid). Renaming a value label re-keys it (a structural change). */
const slugPart = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x";
const valueId = (optionId: string, label: string) => `${optionId}::${slugPart(label)}`;
const variantId = (optionValueIds: string[]) => `var::${[...optionValueIds].sort().join("+")}`;

/** Modifiers + images the editor UI doesn't manage yet — round-tripped verbatim
 *  through a save so an edit never wipes them. */
export interface ProductPassthrough {
  modifierGroups: ProductUpsertInput["modifierGroups"];
  images: ProductUpsertInput["images"];
}

/** API detail → the editor's client draft (+ the passthrough it must preserve). */
export function detailToDraft(d: AdminDetail): {
  draft: ProductDraft;
  status: ProductStatus;
  passthrough: ProductPassthrough;
} {
  // valueId → (option index, label) so a variant's optionValueIds rebuild its
  // label combo in option order.
  const valueMeta = new Map<string, { optIdx: number; label: string }>();
  d.options.forEach((o, optIdx) => {
    for (const v of o.values) valueMeta.set(v.id, { optIdx, label: v.label });
  });

  const variants = d.variants.map((v) => {
    const combo: string[] = Array.from({ length: d.options.length }, () => "");
    for (const vid of v.optionValueIds) {
      const meta = valueMeta.get(vid);
      if (meta) combo[meta.optIdx] = meta.label;
    }
    return {
      id: v.id,
      combo,
      price: v.priceCents / 100,
      sku: v.sku ?? "",
      stock: null as number | null,
      image: null as string | null,
      ingredients: v.ingredients.map((i) => ({
        ingredientId: i.ingredientId,
        quantity: i.quantity,
        visibleToCustomer: i.visibleToCustomer,
        sortOrder: i.sortOrder,
      })),
    };
  });

  const draft: ProductDraft = {
    name: d.name,
    description: d.description ?? "",
    // Product-level photos become the editable media; variant-scoped images are
    // preserved via passthrough (the UI doesn't manage those yet).
    media: d.images
      .filter((img) => img.variantId == null)
      .map((img) => ({ id: img.id, emoji: "", url: img.url })),
    videoUrl: "",
    currency: d.currency,
    price: d.basePriceCents / 100,
    promoPrice: d.promoPriceCents == null ? null : d.promoPriceCents / 100,
    showPrice: true,
    cost: null,
    type: (d.productType as ProductDraft["type"]) ?? "physical",
    stockMode: (d.stockMode as ProductDraft["stockMode"]) ?? "infinite",
    stock: d.stockQty ?? 0,
    sku: "",
    barcode: "",
    weight: null,
    depth: null,
    width: null,
    height: null,
    mpn: d.mpn ?? "",
    ageRange: d.ageRange ?? "all",
    gender: d.gender ?? "unisex",
    categoryIds: d.categoryIds,
    storeIds: d.storeIds,
    featuredSections: [],
    tags: [],
    brand: d.brand ?? "",
    seoTitle: d.seoTitle ?? "",
    seoDescription: d.seoDescription ?? "",
    slug: d.slug,
    recipeNotes: d.recipeNotes ?? "",
    options: d.options.map((o) => ({ id: o.id, name: o.name, values: o.values.map((v) => v.label) })),
    variants,
  };

  return {
    draft,
    status: d.status as ProductStatus,
    passthrough: {
      modifierGroups: d.modifierGroups.map((g) => ({
        id: g.id,
        name: g.name,
        selectionType: g.selectionType as "single" | "multi",
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        required: g.required,
        sortOrder: g.sortOrder,
        options: g.options.map((mo) => ({
          id: mo.id,
          name: mo.name,
          priceDeltaCents: mo.priceDeltaCents,
          pointsDelta: mo.pointsDelta,
          sortOrder: mo.sortOrder,
        })),
      })),
      // Only variant-scoped images round-trip here; product-level photos live in
      // draft.media and are rebuilt on save.
      images: d.images
        .filter((img) => img.variantId != null)
        .map((img) => ({
          id: img.id,
          url: img.url,
          alt: img.alt,
          variantId: img.variantId,
          sortOrder: img.sortOrder,
        })),
    },
  };
}

/** Editor draft → the upsert payload. Prices are major units in the draft →
 *  cents for the API. Deterministic ids keep unchanged rows stable. */
export function draftToUpsert(
  id: string,
  draft: ProductDraft,
  status: ProductStatus,
  passthrough: ProductPassthrough,
): ProductUpsertInput {
  const options = draft.options
    .filter((o) => o.name.trim() && o.values.length > 0)
    .map((o, i) => ({
      id: o.id,
      name: o.name.trim(),
      sortOrder: i,
      values: o.values.map((label, j) => ({ id: valueId(o.id, label), label, sortOrder: j })),
    }));

  const variants = draft.variants.map((v, i) => {
    const optionValueIds = v.combo
      .map((label, idx) => {
        const opt = draft.options[idx];
        return opt && label ? valueId(opt.id, label) : null;
      })
      .filter((x): x is string => x !== null);
    return {
      id: variantId(optionValueIds),
      sku: v.sku.trim() || null,
      priceCents: Math.round(v.price * 100),
      isDefault: i === 0,
      sortOrder: i,
      optionValueIds,
      ingredients: v.ingredients.map((ing, j) => ({
        ingredientId: ing.ingredientId,
        quantity: ing.quantity,
        visibleToCustomer: ing.visibleToCustomer,
        sortOrder: j,
      })),
    };
  });

  return {
    id,
    name: draft.name.trim(),
    description: draft.description || null,
    status,
    basePriceCents: Math.round((draft.price ?? 0) * 100),
    promoPriceCents:
      draft.promoPrice != null && draft.promoPrice > 0
        ? Math.round(draft.promoPrice * 100)
        : null,
    currency: draft.currency,
    brand: draft.brand.trim() || null,
    gender: (draft.gender as ProductUpsertInput["gender"]) ?? null,
    ageRange: (draft.ageRange as ProductUpsertInput["ageRange"]) ?? null,
    mpn: draft.mpn.trim() || null,
    stockMode: draft.stockMode,
    stockQty: draft.stockMode === "limited" ? draft.stock : null,
    productType: draft.type,
    sortOrder: 0,
    recipeNotes: draft.recipeNotes || null,
    seoTitle: draft.seoTitle.trim() || null,
    seoDescription: draft.seoDescription.trim() || null,
    ogImageUrl: null,
    categoryIds: draft.categoryIds,
    storeIds: draft.storeIds,
    options,
    variants,
    modifierGroups: passthrough.modifierGroups,
    // Product photos from the media UI (only uploaded ones have a url) + the
    // preserved variant-scoped images.
    images: [
      ...draft.media
        .filter((m) => m.url)
        .map((m, i) => ({
          id: m.id,
          url: m.url as string,
          alt: null,
          variantId: null,
          sortOrder: i,
        })),
      ...passthrough.images,
    ],
  };
}
