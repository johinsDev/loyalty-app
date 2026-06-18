/**
 * Hardcoded drinks menu — a faithful port of the "T4 · Menú" Claude Design
 * template. Sample content until a real menu/catalog API lands. Category labels
 * are product terms kept inline; the "all" chip + chrome copy come from the
 * `Menu` messages namespace.
 */

export type Drink = {
  id: string;
  emoji: string;
  name: string;
  description: string;
  price: string;
  points: string;
  category: string;
  featured?: boolean;
  seasonal?: boolean;
  /** Whether it starts hearted (favorites are client state seeded from here). */
  favorite?: boolean;
};

/** Product categories (the "Todos"/all chip is added by the catalog). */
export const CATEGORIES = [
  "Milk Tea",
  "Matcha",
  "Frutales",
  "Especiales",
] as const;

export const drinks: readonly Drink[] = [
  {
    id: "matcha",
    emoji: "🍵",
    name: "Iced Matcha Latte",
    description: "Matcha ceremonial, leche de avena",
    price: "$6.25",
    points: "+13 pts",
    category: "Matcha",
    featured: true,
    favorite: true,
  },
  {
    id: "brown",
    emoji: "🧋",
    name: "Brown Sugar Boba",
    description: "Azúcar morena caramelizada, boba fresca",
    price: "$6.75",
    points: "+14 pts",
    category: "Milk Tea",
    favorite: true,
  },
  {
    id: "taro",
    emoji: "🫐",
    name: "Taro Cloud",
    description: "Taro hecho a mano, crema dulce",
    price: "$6.50",
    points: "+13 pts",
    category: "Especiales",
  },
  {
    id: "peach",
    emoji: "🍑",
    name: "Peach Oolong",
    description: "Oolong + durazno, edición Spring",
    price: "$6.50",
    points: "+13 pts",
    category: "Frutales",
    seasonal: true,
  },
  {
    id: "straw",
    emoji: "🍓",
    name: "Strawberry Cloud",
    description: "Fresa fresca, crema de queso",
    price: "$6.90",
    points: "+15 pts",
    category: "Frutales",
    seasonal: true,
  },
  {
    id: "classic",
    emoji: "🥛",
    name: "Classic Milk Tea",
    description: "Té negro, leche, boba",
    price: "$5.50",
    points: "+11 pts",
    category: "Milk Tea",
  },
  {
    id: "matchastraw",
    emoji: "🍵",
    name: "Strawberry Matcha",
    description: "Matcha + fresa, leche de avena",
    price: "$6.80",
    points: "+14 pts",
    category: "Matcha",
  },
  {
    id: "wintermelon",
    emoji: "🍈",
    name: "Wintermelon Tea",
    description: "Wintermelon tostado, refrescante",
    price: "$5.80",
    points: "+12 pts",
    category: "Especiales",
  },
];
