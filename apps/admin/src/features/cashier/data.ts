/**
 * Hardcoded sample data for the cashier (POS-lite) register — design-first, with
 * the seams for the real ledger backend (Phase A). The cashier identifies a
 * socio (QR / phone), marks the purchased products (each grants `earns` stamps,
 * NO prices — the app never charges), and confirms; redemptions are
 * customer-initiated and validated here with a manager PIN. Wired to real tRPC
 * (sellos.add / redemptions.confirm) once the ledger lands.
 */

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

