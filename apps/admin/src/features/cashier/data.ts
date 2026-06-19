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
};

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

export type AttachedReward = {
  emoji: string;
  name: string;
  desc: string;
  cost: number;
};

/** Per-cashier daily stamp cap (anti-fraud). */
export const DAILY_CAP = 150;
export const STAMPS_TODAY = 84;

export const cashier = { name: "Lucía Fernández", initials: "LF" };
export const manager = { name: "D. Rojas" };
export const store = { name: "T4 Centro", shift: "Turno mañana · 08:00–16:00" };

export const products: Product[] = [
  { id: "p1", emoji: "🧋", name: "Milk Tea", earns: 1 },
  { id: "p2", emoji: "🍵", name: "Matcha Latte", earns: 1 },
  { id: "p3", emoji: "🍓", name: "Strawberry Matcha", earns: 2 },
  { id: "p4", emoji: "🧊", name: "Frappé", earns: 1 },
  { id: "p5", emoji: "⭐", name: "Premium del mes", earns: 2 },
  { id: "p6", emoji: "🥤", name: "Refresco", earns: 1 },
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

export type CashierPromo = { emoji: string; name: string; detail: string };
export type CashierReward = {
  emoji: string;
  name: string;
  cost: number;
  locked?: boolean;
};

/** What's live for this customer — the cashier sees it to honor promos + canjes. */
export const activePromos: CashierPromo[] = [
  { emoji: "🔥", name: "2x1 en frappés", detail: "Todos los lunes · todo el día" },
  { emoji: "⭐", name: "Doble puntos", detail: "Compras > $30 · esta semana" },
];

export const claimableRewards: CashierReward[] = [
  { emoji: "🧋", name: "Bebida mediana gratis", cost: 6 },
  { emoji: "✨", name: "Topping gratis", cost: 4 },
];

export const lockedRewards: CashierReward[] = [
  { emoji: "🎂", name: "Postre del mes", cost: 12, locked: true },
  { emoji: "🎁", name: "Combo para dos", cost: 18, locked: true },
];

export const attachedReward: AttachedReward = {
  emoji: "🧋",
  name: "Bebida mediana gratis",
  desc: "Cualquier bebida clásica, tamaño mediano.",
  cost: 6,
};

export const recentMoves: RecentMove[] = [
  { id: "m1", icon: "🧋", name: "Sofía M.", detail: "2 productos · +2 sellos", amount: "+2", time: "14:32", kind: "earn" },
  { id: "m2", icon: "🎁", name: "Bruno T.", detail: "Canje · Topping gratis", amount: "−4", time: "14:18", kind: "redeem" },
  { id: "m3", icon: "🍵", name: "Lucía P.", detail: "1 producto · +1 sello", amount: "+1", time: "13:57", kind: "earn" },
  { id: "m4", icon: "🧊", name: "Mateo R.", detail: "3 productos · +3 sellos", amount: "+3", time: "13:40", kind: "earn" },
  { id: "m5", icon: "⭐", name: "Valentina G.", detail: "Premium · +2 sellos", amount: "+2", time: "13:21", kind: "earn" },
  { id: "m6", icon: "🥤", name: "Diego A.", detail: "1 producto · +1 sello", amount: "+1", time: "12:58", kind: "earn" },
];

export type CashierError =
  | "notfound"
  | "insufficient"
  | "cap"
  | "expired"
  | "camera";
