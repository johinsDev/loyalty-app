import {
  CupSoda,
  Flower2,
  type LucideIcon,
  Leaf,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

/**
 * Hardcoded demo data for the customer home. Everything here is sample content
 * until the wallet/ledger + promos features land — the screen is a faithful
 * build of the "T4 Lovers · Home / Sellos" Claude Design templates. Chrome copy
 * (section labels, nav, CTAs) is translated via the `Home` messages namespace;
 * the values below are content (names, amounts, dates) and stay inline.
 */

export const customer = { name: "Ari", emoji: "🍵" } as const;

/**
 * Purchase streak — consecutive days with a purchase. `week` is the current
 * week (Mon→Sun) where `true` = bought that day; `todayIndex` highlights today.
 */
export const streak = {
  days: 5,
  week: [true, true, false, true, true, true, false],
  todayIndex: 5,
} as const;

/** Points wallet — the ring + tier model. */
export const pointsWallet = {
  points: 312,
  tier: "Hoja",
  tierIcon: Leaf,
  toNextReward: 288,
  // Stroke geometry for the progress ring (r=68 → circumference ≈ 427).
  ringCircumference: 427,
  ringOffset: 218,
  nextTier: { name: "Flor", icon: Flower2, at: 600 },
  tierProgress: 0.35,
} as const;

/** Stamp wallet — every 10th drink is free. */
export const stampsWallet = {
  filled: 7,
  total: 10,
  remaining: 3,
} as const;

/** The single reward that's ready to redeem right now. */
export const readyReward = {
  title: "Topping gratis",
  meta: "50 pts · disponible ahora",
  icon: Sparkles,
} as const;

export type Promo = {
  id: string;
  badge: string;
  title: string;
  sub: string;
  icon: LucideIcon;
  /** [from, to] for the card's diagonal gradient. */
  gradient: readonly [string, string];
};

export const promos: readonly Promo[] = [
  {
    id: "spring",
    badge: "NUEVA TEMPORADA",
    title: "Spring drop",
    sub: "Peach oolong, ya en tienda",
    icon: Flower2,
    gradient: ["#1BAD9D", "#5fe0c8"],
  },
  {
    id: "wednesday",
    badge: "MIÉRCOLES",
    title: "Sellos x2",
    sub: "Todos los miércoles del mes",
    icon: Zap,
    gradient: ["#0e8f9c", "#5fcfce"],
  },
  {
    id: "friend",
    badge: "MIEMBROS",
    title: "Trae un amigo",
    sub: "+5 sellos cuando se una",
    icon: Users,
    gradient: ["#0f8f86", "#46c9b3"],
  },
  {
    id: "matcha",
    badge: "NUEVO",
    title: "Matcha Fresa",
    sub: "Probá la combinación del mes",
    icon: CupSoda,
    gradient: ["#1BAD9D", "#9be6d2"],
  },
];

export type Usual = { name: string; orders: number; icon: LucideIcon };

export const usuals: readonly Usual[] = [
  { name: "Taro Milk Tea", orders: 12, icon: CupSoda },
  { name: "Strawberry Matcha", orders: 9, icon: CupSoda },
  { name: "Matcha Latte", orders: 7, icon: CupSoda },
  { name: "Taro Frappé", orders: 6, icon: CupSoda },
];

export type Visit = { id: number; place: string; reward: string };

export const visits: readonly Visit[] = [
  { id: 1, place: "Hoy · T4 Centro", reward: "+24 pts" },
  { id: 2, place: "12 jun · T4 Centro", reward: "+18 pts" },
  { id: 3, place: "5 jun · T4 Norte", reward: "+30 pts" },
];
