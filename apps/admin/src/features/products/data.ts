// Hardcoded product catalog for the design-first Productos CRUD. Seam: the
// Phase A product catalog (name, category, price, earnsStamp, points). Price is
// optional (POS-agnostic) and only feeds amount-based analytics.

export type Category = "milkTea" | "fruitTea" | "specialty" | "topping";

export type Product = {
  id: string;
  name: string;
  category: Category;
  price: string;
  emoji: string;
  earnsStamp: boolean;
  points: number;
  active: boolean;
};

export const categories: Category[] = [
  "milkTea",
  "fruitTea",
  "specialty",
  "topping",
];

export const products: Product[] = [
  { id: "p_001", name: "Taro Milk Tea", category: "milkTea", price: "$6.50", emoji: "🧋", earnsStamp: true, points: 13, active: true },
  { id: "p_002", name: "Brown Sugar Boba", category: "milkTea", price: "$5.80", emoji: "🧋", earnsStamp: true, points: 12, active: true },
  { id: "p_003", name: "Matcha Latte", category: "specialty", price: "$5.20", emoji: "🍵", earnsStamp: true, points: 10, active: true },
  { id: "p_004", name: "Mango Green Tea", category: "fruitTea", price: "$4.90", emoji: "🥭", earnsStamp: true, points: 10, active: true },
  { id: "p_005", name: "Passion Fruit Tea", category: "fruitTea", price: "$4.90", emoji: "🍈", earnsStamp: true, points: 10, active: true },
  { id: "p_006", name: "Thai Tea", category: "specialty", price: "$5.40", emoji: "🧡", earnsStamp: true, points: 11, active: true },
  { id: "p_007", name: "Tapioca extra", category: "topping", price: "$0.80", emoji: "⚫", earnsStamp: false, points: 0, active: true },
  { id: "p_008", name: "Pudding topping", category: "topping", price: "$1.00", emoji: "🍮", earnsStamp: false, points: 0, active: false },
];

export type ProductDraft = {
  name: string;
  category: Category;
  price: string;
  description: string;
  emoji: string;
  earnsStamp: boolean;
  points: number;
};

export const emptyProductDraft: ProductDraft = {
  name: "",
  category: "milkTea",
  price: "",
  description: "",
  emoji: "🧋",
  earnsStamp: true,
  points: 10,
};

/** Resolve a product into an editable draft. Hardcoded — unknown ids fall back
 * to the first product so deep links never 404 in the design build. */
export function getProductDraft(id: string): ProductDraft {
  const p = products.find((x) => x.id === id) ?? products[0]!;
  return {
    name: p.name,
    category: p.category,
    price: p.price,
    description: "Bebida estrella de la casa, lista para personalizar.",
    emoji: p.emoji,
    earnsStamp: p.earnsStamp,
    points: p.points,
  };
}

export const PRODUCT_EMOJIS = ["🧋", "🍵", "🥭", "🍈", "🧡", "🍓", "🫐", "🍮"];
