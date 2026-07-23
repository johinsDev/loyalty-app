/**
 * Hardcoded sample data for the cashier (POS-lite) register — design-first, with
 * the seams for the real ledger backend (Phase A). The cashier identifies a
 * socio (QR / phone), marks the purchased products (each grants `earns` stamps,
 * NO prices — the app never charges), and confirms; redemptions are
 * customer-initiated and validated here with a manager PIN. Wired to real tRPC
 * (sellos.add / redemptions.confirm) once the ledger lands.
 */



export type MemberPurchase = {
  id: string;
  date: string;
  items: string;
  stamps: string;
  /** Line items for the detail receipt. */
  lines: string[];
  cashier: string;
  store: string;
};

/** The identified socio's recent purchases (also pulled for any customer). */
export const memberPurchases: MemberPurchase[] = [
  { id: "h1", date: "Hoy · 14:32", items: "Milk Tea, Matcha Latte", stamps: "+2", lines: ["1× Milk Tea", "1× Matcha Latte"], cashier: "Lucía F.", store: "T4 Centro" },
  { id: "h2", date: "Ayer · 18:10", items: "Strawberry Matcha", stamps: "+2", lines: ["1× Strawberry Matcha"], cashier: "Bruno T.", store: "T4 Centro" },
  { id: "h3", date: "12 jun · 09:48", items: "Frappé", stamps: "+1", lines: ["1× Frappé"], cashier: "Lucía F.", store: "T4 Norte" },
  { id: "h4", date: "8 jun · 16:22", items: "Canje · Topping gratis", stamps: "−4", lines: ["Canje · Topping gratis"], cashier: "Lucía F.", store: "T4 Centro" },
  { id: "h5", date: "3 jun · 11:05", items: "Premium del mes, Refresco", stamps: "+3", lines: ["1× Premium del mes", "1× Refresco"], cashier: "Mateo R.", store: "T4 Centro" },
];

export type CashierCustomer = {
  name: string;
  initials: string;
  /** Masked phone shown at the register — never full PII. */
  phone: string;
  tier: string;
  tierEmoji: string;
  stamps: number;
  stampGoal: number;
  points: number;
  toNext: string;
};

export const cashier = { name: "Lucía Fernández", initials: "LF" };

export type TeaAvatar = {
  id: string;
  emoji: string;
  /** [from, to] for the avatar's diagonal gradient. */
  gradient: readonly [string, string];
};

/** Predefined tea avatars the cashier can pick (admin can extend later). */
export const teaAvatars: readonly TeaAvatar[] = [
  { id: "matcha", emoji: "🍵", gradient: ["#b9f3e4", "#4fd1b5"] },
  { id: "boba", emoji: "🧋", gradient: ["#d9c9ff", "#9d7bff"] },
  { id: "strawberry", emoji: "🍓", gradient: ["#ffd6e7", "#ff8fb8"] },
  { id: "peach", emoji: "🍑", gradient: ["#ffe0c2", "#ffb05f"] },
  { id: "leaf", emoji: "🍃", gradient: ["#d6f5c9", "#8fd96f"] },
  { id: "blossom", emoji: "🌸", gradient: ["#ffd0ad", "#ff9d6e"] },
  { id: "teapot", emoji: "🫖", gradient: ["#c9d8ff", "#7e9bff"] },
  { id: "honey", emoji: "🍯", gradient: ["#fff0c2", "#ffce4f"] },
];

export const AVATAR_ACCEPT = ["image/png", "image/jpeg", "image/webp"] as const;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB


export const foundCustomer: CashierCustomer = {
  name: "Ariadna Pérez",
  initials: "AP",
  phone: "T4 ·· 4821",
  tier: "Nivel Hoja",
  tierEmoji: "🌿",
  stamps: 7,
  stampGoal: 10,
  points: 312,
  toNext: "Faltan 288 pts para 🌸 Flor",
};

export type CashierPromo = {
  emoji: string;
  name: string;
  detail: string;
  description: string;
};
export type CashierReward = {
  emoji: string;
  name: string;
  cost: number;
  description: string;
  locked?: boolean;
};

/** What's live for this customer — the cashier sees it to honor promos + canjes. */
export const activePromos: CashierPromo[] = [
  {
    emoji: "🔥",
    name: "2x1 en frappés",
    detail: "Todos los lunes · todo el día",
    description:
      "Llevá dos frappés y pagá uno. Aplicá el descuento en el POS; el sistema solo otorga los sellos.",
  },
  {
    emoji: "⭐",
    name: "Doble puntos",
    detail: "Compras > $30 · esta semana",
    description:
      "Las compras mayores a $30 acumulan el doble de puntos. Cargá el monto al sumar.",
  },
];

export const claimableRewards: CashierReward[] = [
  {
    emoji: "🧋",
    name: "Bebida mediana gratis",
    cost: 6,
    description: "Cualquier bebida clásica, tamaño mediano.",
  },
  {
    emoji: "✨",
    name: "Topping gratis",
    cost: 4,
    description: "Un topping a elección en cualquier bebida.",
  },
];

export const lockedRewards: CashierReward[] = [
  {
    emoji: "🎂",
    name: "Postre del mes",
    cost: 12,
    locked: true,
    description: "Postre especial de la carta del mes.",
  },
  {
    emoji: "🎁",
    name: "Combo para dos",
    cost: 18,
    locked: true,
    description: "Dos bebidas medianas + un snack para compartir.",
  },
];

