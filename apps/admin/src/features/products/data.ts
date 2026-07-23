// Hardcoded product catalog for the design-first Productos CRUD — a structured,
// ecommerce-style model (Shopify/Tiendanube): categories with subcategories +
// order, products with options→variants (price/sku/stock), multiple categories,
// media, prices, inventory, codes, shipping, marketing meta + SEO. Seam: the
// Phase A product catalog + storage channel for media. Prices are numbers.

// ── Categories (tree + order) ───────────────────────────────────────────────

export type Subcategory = { id: string; name: string };
export type Category = {
  id: string;
  name: string;
  subcategories: Subcategory[];
};

export const categories: Category[] = [
  {
    id: "c_milk",
    name: "Milk Tea",
    subcategories: [
      { id: "s_classic", name: "Clásicos" },
      { id: "s_brown", name: "Brown Sugar" },
    ],
  },
  {
    id: "c_fruit",
    name: "Fruit Tea",
    subcategories: [{ id: "s_citrus", name: "Cítricos" }],
  },
  { id: "c_specialty", name: "Especialidades", subcategories: [] },
  {
    id: "c_toppings",
    name: "Toppings",
    subcategories: [{ id: "s_boba", name: "Boba" }],
  },
];

// ── Products ────────────────────────────────────────────────────────────────

/** Lifecycle status persisted on the real product (matches the API enum). */
export type ProductStatus = "active" | "draft" | "archived";

// Options → variants (Shopify-style). Options like {Tamaño:[Regular,Grande]};
// the editor generates one variant per combination, each with price/sku/stock.
export type ProductOption = { id: string; name: string; values: string[] };

// Reusable option library — options + values created once become available for
// the next product. Seam: an org-level options table. Editor seeds local state
// from this and appends custom options/values.
export type OptionPreset = { id: string; name: string; values: string[] };

export const optionLibrary: OptionPreset[] = [
  { id: "lib_size", name: "Tamaño", values: ["Regular", "Grande"] },
  { id: "lib_temp", name: "Temperatura", values: ["Frío", "Caliente"] },
  { id: "lib_sweet", name: "Dulzor", values: ["0%", "50%", "100%"] },
];
/** One recipe line on a variant: how much of a catalog ingredient it uses. */
export type RecipeLine = {
  ingredientId: string;
  quantity: number;
  visibleToCustomer: boolean;
  /** Visible + removable → a "sin X" toggle at the register (subtractive). */
  removable: boolean;
  sortOrder: number;
};

export type Variant = {
  id: string;
  combo: string[]; // one value per option, in option order
  price: number;
  sku: string;
  stock: number | null; // null = infinite
  image: string | null; // media id, or null = use the main image
  ingredients: RecipeLine[];
};

/** A product photo (`url` set = uploaded image) or an icon fallback (`emoji`). */
export type ProductMedia = { id: string; emoji: string; url?: string | null };

export type ProductType = "physical" | "digital";
export type StockMode = "infinite" | "limited";

export type ProductDraft = {
  name: string;
  description: string; // HTML (rich text)
  media: ProductMedia[];
  videoUrl: string;
  currency: string;
  price: number | null;
  promoPrice: number | null;
  showPrice: boolean;
  cost: number | null;
  type: ProductType;
  stockMode: StockMode;
  stock: number;
  sku: string;
  barcode: string;
  weight: number | null;
  depth: number | null;
  width: number | null;
  height: number | null;
  mpn: string;
  ageRange: string;
  gender: string;
  categoryIds: string[];
  /** Stores this product is available at (null = every store). */
  storeIds: string[] | null;
  featuredSections: string[];
  tags: string[];
  brand: string;
  seoTitle: string;
  seoDescription: string;
  slug: string;
  recipeNotes: string;
  options: ProductOption[];
  variants: Variant[];
  addonGroups: AddonGroupDraft[];
};

/** A group attaching reusable catalog add-ons to this product. */
export type AddonGroupDraft = {
  id: string;
  name: string;
  selectionType: "single" | "multi";
  required: boolean;
  sortOrder: number;
  /** Catalog add-on ids this group offers. */
  addonIds: string[];
};

export const FEATURED_SECTIONS = ["featured", "new", "deals"] as const;
export const AGE_RANGES = ["all", "kids", "teens", "adults"] as const;
export const GENDERS = ["unisex", "female", "male"] as const;
export const PRODUCT_EMOJIS = ["🧋", "🍵", "🥭", "🍈", "🧡", "🍓", "🫐", "🍮", "⚫", "🧁"];

export const CURRENCIES = ["USD", "COP", "MXN", "EUR"] as const;

export const emptyProductDraft: ProductDraft = {
  name: "",
  description: "",
  media: [],
  videoUrl: "",
  currency: "USD",
  price: null,
  promoPrice: null,
  showPrice: true,
  cost: null,
  type: "physical",
  stockMode: "infinite",
  stock: 0,
  sku: "",
  barcode: "",
  weight: null,
  depth: null,
  width: null,
  height: null,
  mpn: "",
  ageRange: "all",
  gender: "unisex",
  categoryIds: [],
  storeIds: null,
  featuredSections: [],
  tags: [],
  brand: "",
  seoTitle: "",
  seoDescription: "",
  slug: "",
  recipeNotes: "",
  options: [],
  variants: [],
  addonGroups: [],
};

/** Cartesian product of an option list → variant rows (preserving existing
 * price/sku/stock by combo where possible). */
export function buildVariants(
  options: ProductOption[],
  existing: Variant[] = [],
  defaultPrice = 0,
): Variant[] {
  const usable = options.filter((o) => o.name.trim() && o.values.length > 0);
  if (usable.length === 0) return [];
  let combos: string[][] = [[]];
  for (const o of usable) {
    combos = combos.flatMap((c) => o.values.map((v) => [...c, v]));
  }
  return combos.map((combo) => {
    const key = combo.join(" / ");
    const prev = existing.find((e) => e.combo.join(" / ") === key);
    // New rows inherit the product's base price (owner can override per row).
    return (
      prev ?? {
        id: `v_${key}`,
        combo,
        price: defaultPrice,
        sku: "",
        stock: null,
        image: null,
        ingredients: [],
      }
    );
  });
}

