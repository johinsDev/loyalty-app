/**
 * Hardcoded sample data for the cashier (POS-lite) register — design-first, with
 * the seams for the real ledger backend (Phase A). The cashier identifies a
 * socio (QR / phone), marks the purchased products (each grants `earns` stamps,
 * NO prices — the app never charges), and confirms; redemptions are
 * customer-initiated and validated here with a manager PIN. Wired to real tRPC
 * (sellos.add / redemptions.confirm) once the ledger lands.
 */

export type Product = {
  id: string;
  emoji: string;
  name: string;
  earns: number;
  category: string;
  description: string;
};

/** Catalog categories the cashier can filter the menu by. */
export const categories = ["Tés", "Matcha", "Frappés", "Otros"] as const;

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

export type RecentMove = {
  id: string;
  icon: string;
  name: string;
  detail: string;
  amount: string;
  time: string;
  kind: "earn" | "redeem";
};

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

/** Per-cashier daily stamp cap (anti-fraud). */
export const DAILY_CAP = 150;
export const STAMPS_TODAY = 84;

export const cashier = { name: "Lucía Fernández", initials: "LF" };
export const manager = { name: "D. Rojas" };

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
export const store = { name: "T4 Centro", shift: "Turno mañana · 08:00–16:00" };

/** The reward a member is redeeming (decoded from their single-use code). */
export const redeemReward = {
  emoji: "🧋",
  name: "Bebida mediana gratis",
  desc: "Cualquier bebida clásica, tamaño mediano.",
  cost: 6,
};

export const products: Product[] = [
  { id: "p1", emoji: "🧋", name: "Milk Tea", earns: 1, category: "Tés", description: "Té negro con leche y perlas de tapioca." },
  { id: "p2", emoji: "🍵", name: "Matcha Latte", earns: 1, category: "Matcha", description: "Matcha ceremonial batido con leche." },
  { id: "p3", emoji: "🍓", name: "Strawberry Matcha", earns: 2, category: "Matcha", description: "Matcha con capa de fresa natural." },
  { id: "p4", emoji: "🧊", name: "Frappé", earns: 1, category: "Frappés", description: "Bebida helada licuada, base a elección." },
  { id: "p5", emoji: "⭐", name: "Premium del mes", earns: 2, category: "Otros", description: "Edición especial — rota cada mes." },
  { id: "p6", emoji: "🥤", name: "Refresco", earns: 1, category: "Otros", description: "Gaseosa o agua saborizada." },
];

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

/** Extra socio info the cashier can pull up to verify things (e.g. birthday). */
export const memberDetail = {
  email: "a·····z@gmail.com",
  memberSince: "Mar 2024",
  birthday: "14 de marzo",
  visits: 23,
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

export const recentMoves: RecentMove[] = [
  { id: "m1", icon: "🧋", name: "Sofía M.", detail: "2 productos · +2 sellos", amount: "+2", time: "14:32", kind: "earn" },
  { id: "m2", icon: "🎁", name: "Bruno T.", detail: "Canje · Topping gratis", amount: "−4", time: "14:18", kind: "redeem" },
  { id: "m3", icon: "🍵", name: "Lucía P.", detail: "1 producto · +1 sello", amount: "+1", time: "13:57", kind: "earn" },
  { id: "m4", icon: "🧊", name: "Mateo R.", detail: "3 productos · +3 sellos", amount: "+3", time: "13:40", kind: "earn" },
  { id: "m5", icon: "⭐", name: "Valentina G.", detail: "Premium · +2 sellos", amount: "+2", time: "13:21", kind: "earn" },
  { id: "m6", icon: "🥤", name: "Diego A.", detail: "1 producto · +1 sello", amount: "+1", time: "12:58", kind: "earn" },
];

