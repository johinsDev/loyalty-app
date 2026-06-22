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

/** Flat list of "Category" + "Category / Subcategory" labels for the picker. */
export type CategoryRef = { id: string; label: string };
export function categoryRefs(): CategoryRef[] {
  const out: CategoryRef[] = [];
  for (const c of categories) {
    out.push({ id: c.id, label: c.name });
    for (const s of c.subcategories) {
      out.push({ id: `${c.id}:${s.id}`, label: `${c.name} / ${s.name}` });
    }
  }
  return out;
}

export function categoryLabel(id: string): string {
  return categoryRefs().find((r) => r.id === id)?.label ?? id;
}

// ── Products ────────────────────────────────────────────────────────────────

export type Status = "active" | "draft";

export type Product = {
  id: string;
  name: string;
  emoji: string;
  price: number;
  categoryIds: string[];
  variantCount: number;
  status: Status;
};

export const products: Product[] = [
  { id: "p_001", name: "Taro Milk Tea", emoji: "🧋", price: 6.5, categoryIds: ["c_milk:s_classic"], variantCount: 2, status: "active" },
  { id: "p_002", name: "Brown Sugar Boba", emoji: "🧋", price: 5.8, categoryIds: ["c_milk:s_brown"], variantCount: 2, status: "active" },
  { id: "p_003", name: "Matcha Latte", emoji: "🍵", price: 5.2, categoryIds: ["c_specialty"], variantCount: 2, status: "active" },
  { id: "p_004", name: "Mango Green Tea", emoji: "🥭", price: 4.9, categoryIds: ["c_fruit:s_citrus"], variantCount: 2, status: "active" },
  { id: "p_005", name: "Smoothie de maracuyá", emoji: "🍈", price: 5.0, categoryIds: ["c_fruit"], variantCount: 2, status: "active" },
  { id: "p_006", name: "Thai Tea", emoji: "🧡", price: 5.4, categoryIds: ["c_specialty"], variantCount: 1, status: "active" },
  { id: "p_007", name: "Tapioca", emoji: "⚫", price: 0.8, categoryIds: ["c_toppings:s_boba"], variantCount: 1, status: "active" },
  { id: "p_008", name: "Pudding", emoji: "🍮", price: 1.0, categoryIds: ["c_toppings"], variantCount: 1, status: "draft" },
];

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
export type Variant = {
  id: string;
  combo: string[]; // one value per option, in option order
  price: number;
  sku: string;
  stock: number | null; // null = infinite
  image: string | null; // media id, or null = use the main image
};

export type ProductMedia = { id: string; emoji: string };

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
  featuredSections: string[];
  tags: string[];
  brand: string;
  seoTitle: string;
  seoDescription: string;
  slug: string;
  options: ProductOption[];
  variants: Variant[];
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
  featuredSections: [],
  tags: [],
  brand: "",
  seoTitle: "",
  seoDescription: "",
  slug: "",
  options: [],
  variants: [],
};

/** Cartesian product of an option list → variant rows (preserving existing
 * price/sku/stock by combo where possible). */
export function buildVariants(
  options: ProductOption[],
  existing: Variant[] = [],
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
    return (
      prev ?? { id: `v_${key}`, combo, price: 0, sku: "", stock: null, image: null }
    );
  });
}

const SAMPLE_OPTIONS: ProductOption[] = [
  { id: "o_size", name: "Tamaño", values: ["Regular", "Grande"] },
];

/** Resolve a product into an editable draft. Hardcoded — unknown ids fall back
 * to a representative sample so deep links never 404 in the design build. */
export function getProductDraft(id: string): ProductDraft {
  const base = products.find((x) => x.id === id) ?? products[0]!;
  const options = base.variantCount > 1 ? SAMPLE_OPTIONS : [];
  const variants = buildVariants(options).map((v, i) => ({
    ...v,
    price: base.price + i * 1.5,
  }));
  return {
    ...emptyProductDraft,
    name: base.name,
    description: "<p>Bebida estrella de la casa, lista para personalizar.</p>",
    media: [{ id: "m1", emoji: base.emoji }],
    price: base.price,
    showPrice: true,
    categoryIds: base.categoryIds,
    options,
    variants,
  };
}
