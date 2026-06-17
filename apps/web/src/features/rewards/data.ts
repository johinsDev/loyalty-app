/**
 * Hardcoded demo data for the customer rewards screen — a faithful build of the
 * "T4 · Recompensas (Sellos)" Claude Design template. Everything here is sample
 * content until the wallet/ledger + rewards catalog features land. Chrome copy
 * (title, filters, nav, CTAs) is translated via the `Rewards` namespace; the
 * values below are content (names, descriptions, dates) and stay inline.
 *
 * The currency is **sellos** (stamps): a reward is claimable once the balance
 * covers its cost, otherwise it's "próxima" (coming up).
 */

/** Current stamp balance the whole screen reasons about. */
export const stampsBalance = 12;

/** Tier / level standing — current level, the next one, and what it unlocks. */
export const tier = {
  current: { name: "Hoja", emoji: "🌿" },
  next: { name: "Flor", emoji: "🌸", at: 20 },
  /** Stamps still needed to reach `next` (kept in sync with `at` − balance). */
  remaining: 8,
  benefits: [
    "Bebida de especialidad gratis",
    "Combo amigo: 2 bebidas",
    "Línea exprés en el local",
  ],
} as const;

export type Reward = {
  id: string;
  emoji: string;
  name: string;
  description: string;
  /** Cost in sellos. */
  cost: number;
  /** Tier this reward belongs to — shown when it's still locked. */
  tier?: string;
};

export const rewards: readonly Reward[] = [
  {
    id: "topping",
    emoji: "✨",
    name: "Topping gratis",
    description: "Sumá perlas, jelly o popping a tu bebida.",
    cost: 5,
  },
  {
    id: "size",
    emoji: "⬆️",
    name: "Upsize gratis",
    description: "Pasá cualquier bebida a tamaño grande.",
    cost: 8,
  },
  {
    id: "classic",
    emoji: "🧋",
    name: "Bebida clásica gratis",
    description: "Cualquier milk tea clásico, gratis.",
    cost: 10,
  },
  {
    id: "specialty",
    emoji: "🍓",
    name: "Bebida de especialidad",
    description: "Cualquier bebida de especialidad o de temporada.",
    cost: 20,
    tier: "Flor",
  },
  {
    id: "friend",
    emoji: "👯",
    name: "Combo amigo",
    description: "Dos bebidas gratis — traé a alguien nuevo.",
    cost: 25,
    tier: "Flor",
  },
  {
    id: "reserve",
    emoji: "⭐",
    name: "Cata reserva",
    description: "Flight de 3 tés de reserva, edición limitada.",
    cost: 50,
    tier: "Reserva",
  },
];

export type Redemption = {
  id: string;
  emoji: string;
  name: string;
  date: string;
  /** Signed stamp delta, pre-formatted (content). */
  amount: string;
};

export const recentRedemptions: readonly Redemption[] = [
  { id: "r1", emoji: "✨", name: "Topping gratis", date: "24 abr", amount: "−5 sellos" },
  { id: "r2", emoji: "⬆️", name: "Upsize gratis", date: "11 abr", amount: "−8 sellos" },
  { id: "r3", emoji: "✨", name: "Topping gratis", date: "28 mar", amount: "−5 sellos" },
];
