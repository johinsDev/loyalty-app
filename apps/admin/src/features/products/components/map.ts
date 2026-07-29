import type { AppRouter } from "@loyalty/api";
import type { ProductUpsertInput } from "@loyalty/api/features/products/write-schemas";
import type { inferRouterOutputs } from "@trpc/server";

import type { ProductDraft, ProductMedia, ProductStatus } from "../data";

type AdminDetail = NonNullable<inferRouterOutputs<AppRouter>["menu"]["getAdmin"]>;

/** Deterministic ids so unchanged options/values/variants keep their id across
 *  saves (the backend diffs by id → promo/reward refs to variant/modifierOption
 *  ids stay valid). Renaming a value label re-keys it (a structural change). */
const slugPart = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x";
const valueId = (optionId: string, label: string) => `${optionId}::${slugPart(label)}`;
const variantId = (optionValueIds: string[]) => `var::${[...optionValueIds].sort().join("+")}`;

/** The variant-scoped `product_image` row id, derived from the variant id so a
 *  re-save updates the same row and unlinking the image deletes it. */
const variantImageId = (vid: string) => `${vid}::img`;

/** Modifiers the editor UI doesn't manage yet — round-tripped verbatim through a
 *  save so an edit never wipes them. */
export interface ProductPassthrough {
  modifierGroups: ProductUpsertInput["modifierGroups"];
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

  // Product-level photos are the editable media. A variant's image is a
  // `product_image` row scoped to that variant; it's shown among the product
  // photos so the picker can select it — appended at the end, never at index 0
  // (that one is the "main" photo).
  const media: ProductMedia[] = d.images
    .filter((img) => img.variantId == null)
    .map((img) => ({ id: img.id, emoji: "", url: img.url }));
  const mediaIdByUrl = new Map(media.map((m) => [m.url, m.id]));
  const mediaIdForUrl = (id: string, url: string) => {
    const known = mediaIdByUrl.get(url);
    if (known != null) return known;
    media.push({ id, emoji: "", url });
    mediaIdByUrl.set(url, id);
    return id;
  };

  const variants = d.variants.map((v) => {
    const combo: string[] = Array.from({ length: d.options.length }, () => "");
    for (const vid of v.optionValueIds) {
      const meta = valueMeta.get(vid);
      if (meta) combo[meta.optIdx] = meta.label;
    }
    const own = d.images.find((img) => img.variantId === v.id);
    return {
      id: v.id,
      combo,
      price: v.priceCents / 100,
      promoPrice: v.promoPriceCents == null ? null : v.promoPriceCents / 100,
      sku: v.sku ?? "",
      stock: null as number | null,
      image: own ? mediaIdForUrl(own.id, own.url) : null,
      ingredients: v.ingredients.map((i) => ({
        ingredientId: i.ingredientId,
        quantity: i.quantity,
        visibleToCustomer: i.visibleToCustomer,
        removable: i.removable,
        sortOrder: i.sortOrder,
      })),
    };
  });

  const draft: ProductDraft = {
    name: d.name,
    description: d.description ?? "",
    media,
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
    addonGroups: d.addonGroups.map((g) => ({
      id: g.id,
      name: g.name,
      selectionType: g.selectionType as "single" | "multi",
      required: g.required,
      sortOrder: g.sortOrder,
      addonIds: g.items.map((it) => it.addonId),
    })),
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
    },
  };
}

/** Drop a photo from the draft and unlink every variant that pointed at it, so
 *  no variant is left referencing media that no longer exists. */
export function removeMediaFromDraft(draft: ProductDraft, mediaId: string): ProductDraft {
  return {
    ...draft,
    media: draft.media.filter((m) => m.id !== mediaId),
    variants: draft.variants.map((v) => (v.image === mediaId ? { ...v, image: null } : v)),
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
      promoPriceCents:
        v.promoPrice != null && v.promoPrice > 0 ? Math.round(v.promoPrice * 100) : null,
      isDefault: i === 0,
      sortOrder: i,
      optionValueIds,
      ingredients: v.ingredients.map((ing, j) => ({
        ingredientId: ing.ingredientId,
        quantity: ing.quantity,
        visibleToCustomer: ing.visibleToCustomer,
        removable: ing.removable,
        sortOrder: j,
      })),
    };
  });

  // A variant's image is a `product_image` row scoped to that variant, holding
  // the url of the product photo it points at. Emoji-only media can't be stored
  // (there's no url), so those selections produce no row.
  const urlByMediaId = new Map(
    draft.media.filter((m) => m.url).map((m) => [m.id, m.url as string]),
  );
  const variantImages = draft.variants.flatMap((v, i) => {
    const vid = variants[i]?.id;
    const url = v.image == null ? undefined : urlByMediaId.get(v.image);
    if (vid == null || url == null) return [];
    return [
      { id: variantImageId(vid), url, alt: null, variantId: vid, sortOrder: i },
    ];
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
    // Persist groups with at least one add-on (name optional); an in-progress
    // group with no add-ons is dropped so it can't fail the save.
    addonGroups: draft.addonGroups
      .filter((g) => g.addonIds.length > 0)
      .map((g, i) => ({
        id: g.id,
        name: g.name.trim(),
        selectionType: g.selectionType,
        minSelect: g.required ? 1 : 0,
        maxSelect: null,
        required: g.required,
        sortOrder: i,
        items: g.addonIds.map((addonId, j) => ({
          id: `${g.id}::${addonId}`,
          addonId,
          sortOrder: j,
        })),
      })),
    // Product photos from the media UI (only uploaded ones have a url) + one
    // row per variant that picked an image.
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
      ...variantImages,
    ],
  };
}
