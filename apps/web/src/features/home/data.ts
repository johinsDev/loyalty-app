import { CupSoda, Flower2, type LucideIcon, Leaf, Sparkles } from "lucide-react";

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

/**
 * Recent point-earning entries shown when the points ring is tapped. Demo
 * content until the wallet/ledger feature lands.
 */
export type PointsEntry = {
  id: string;
  emoji: string;
  label: string;
  meta: string;
  points: number;
};

export const pointsActivity: readonly PointsEntry[] = [
  { id: "p1", emoji: "🧋", label: "Brown Sugar Milk Tea", meta: "Hoy · T4 Centro", points: 24 },
  { id: "p2", emoji: "🍓", label: "Strawberry Matcha", meta: "12 jun · T4 Centro", points: 18 },
  { id: "p3", emoji: "🥤", label: "Taro Frappé", meta: "5 jun · T4 Norte", points: 30 },
  { id: "p4", emoji: "🍵", label: "Matcha Latte", meta: "1 jun · T4 Centro", points: 19 },
];

/**
 * What each earned stamp came from — keyed by stamp position (1-based). Tapping
 * a filled stamp reveals the purchase that granted it. Demo content.
 */
export type StampPurchase = {
  drink: string;
  emoji: string;
  meta: string;
  points: number;
};

export const stampPurchases: Readonly<Record<number, StampPurchase>> = {
  1: { drink: "Taro Milk Tea", emoji: "🧋", meta: "2 may · T4 Centro", points: 22 },
  2: { drink: "Matcha Latte", emoji: "🍵", meta: "8 may · T4 Norte", points: 19 },
  3: { drink: "Strawberry Fresh Tea", emoji: "🍓", meta: "15 may · T4 Centro", points: 23 },
  4: { drink: "Brown Sugar Milk Tea", emoji: "🧋", meta: "21 may · T4 Centro", points: 38 },
  5: { drink: "Peach Oolong Tea", emoji: "🍑", meta: "28 may · T4 Norte", points: 21 },
  6: { drink: "Taro Frappé", emoji: "🥤", meta: "5 jun · T4 Norte", points: 30 },
  7: { drink: "Brown Sugar Milk Tea", emoji: "🧋", meta: "Hoy · T4 Centro", points: 24 },
};
