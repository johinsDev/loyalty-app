// Points + tiers config — hardcoded for the pilot. Every value here becomes
// admin-configurable later; this file is the single seam where that swap happens.

/** Master switch: when false, purchases earn no points. */
export const POINTS_ENABLED = true;

// Earn rate: `floor((priceCents / 100) / EARN_PER) * EARN_POINTS`.
// priceCents/100 = major currency units (COP). Default → 100 COP = 4 pts.
export const EARN_PER = 100;
export const EARN_POINTS = 4;

/** Rolling window (days) whose earned points determine the tier. */
export const WINDOW_DAYS = 30;

/** Fire the "almost at next level" nudge at this fraction of the next threshold. */
export const NEAR_THRESHOLD_PCT = 0.8;

export type BenefitType = "discount" | "multiplier" | "promo" | "text";

export interface TierBenefit {
  type: BenefitType;
  /** Human label shown on the tier card (display-only in v1). */
  label: string;
  /** discount → %, multiplier → x. Unused for promo/text. */
  value?: number;
}

export interface TierConfig {
  key: string;
  name: string;
  description: string;
  /** Brand color (hex) for the tier badge/ring. */
  color: string;
  /** Lucide icon key, mapped on the FE. */
  icon: string;
  /** Optional tier image (URL). */
  image?: string;
  /** Tier-points (earned in the window) needed to reach this tier. */
  threshold: number;
  benefits: TierBenefit[];
  /** Terms & conditions shown on the new-tier celebration. */
  terms?: string;
}

// Ordered ascending by threshold; the first (threshold 0) is the base tier
// everyone starts at. Names/colors mirror the existing PointsCard mock.
export const TIERS: TierConfig[] = [
  {
    key: "hoja",
    name: "Hoja",
    description: "Tu punto de partida. ¡Empezá a sumar!",
    color: "#3F9C6D",
    icon: "leaf",
    threshold: 0,
    benefits: [{ type: "text", label: "Acumulás puntos en cada compra" }],
  },
  {
    key: "flor",
    name: "Flor",
    description: "Vas tomando ritmo.",
    color: "#E8597B",
    icon: "flower",
    threshold: 600,
    benefits: [
      { type: "discount", value: 5, label: "5% de descuento en toda la tienda" },
      { type: "promo", label: "Promos exclusivas para tu nivel" },
    ],
    terms: "Beneficios válidos mientras mantengas el nivel. No acumulables con otras promos.",
  },
  {
    key: "oro",
    name: "Oro",
    description: "Sos de los que más nos visitan. 🌟",
    color: "#E0A52B",
    icon: "crown",
    threshold: 1200,
    benefits: [
      { type: "multiplier", value: 2, label: "2x puntos en cada compra" },
      { type: "discount", value: 10, label: "10% de descuento en toda la tienda" },
      { type: "promo", label: "Acceso anticipado a lanzamientos" },
      { type: "text", label: "Bebida de cumpleaños 🎂" },
    ],
    terms: "Beneficios válidos mientras mantengas el nivel. No acumulables con otras promos.",
  },
];
