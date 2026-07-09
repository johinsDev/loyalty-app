import type { RewardBenefitConfig } from "@loyalty/db/schema";

import type { RewardType } from "./schemas";

/**
 * Curated reward templates for the pre-wizard gallery (typed code constants,
 * like the promo templates). Catalog-specific refs are left empty so the owner
 * picks them in the benefit step.
 */
export interface RewardTemplate {
  key: string;
  type: RewardType;
  name: { es: string; en: string };
  icon: string;
  backgroundCss: string;
  description: { es: string; en: string };
  benefit: RewardBenefitConfig;
  costPreset?: { stampsRequired?: number; pointsCost?: number };
  fulfillmentNote?: string;
}

export const REWARD_TEMPLATES: RewardTemplate[] = [
  {
    key: "free-drink",
    type: "freeProduct",
    name: { es: "Bebida gratis", en: "Free drink" },
    icon: "🧋",
    backgroundCss: "linear-gradient(135deg, #1BAD9D, #0e6f64)",
    description: { es: "Una bebida de cortesía por tus sellos.", en: "A free drink for your stamps." },
    benefit: { type: "freeProduct", refs: [] },
    costPreset: { stampsRequired: 10 },
  },
  {
    key: "free-topping",
    type: "freeProduct",
    name: { es: "Topping gratis", en: "Free topping" },
    icon: "✨",
    backgroundCss: "linear-gradient(135deg, #f0a868, #e0467c)",
    description: { es: "Un topping de regalo en tu bebida.", en: "A free topping on your drink." },
    benefit: { type: "freeProduct", refs: [] },
    costPreset: { stampsRequired: 4 },
  },
  {
    key: "upsize",
    type: "freeProduct",
    name: { es: "Agranda tu bebida", en: "Upsize your drink" },
    icon: "⬆️",
    backgroundCss: "linear-gradient(135deg, #7c5cff, #4527a0)",
    description: { es: "El agrandado va por nuestra cuenta (elige el adicional de tamaño).", en: "The upsize is on us (pick the size modifier)." },
    benefit: { type: "freeProduct", refs: [] },
    costPreset: { stampsRequired: 3 },
  },
  {
    key: "amount-off",
    type: "amountOff",
    name: { es: "Descuento en pesos", en: "Amount off" },
    icon: "💵",
    backgroundCss: "linear-gradient(135deg, #0e6f64, #1BAD9D)",
    description: { es: "Un descuento directo en tu compra.", en: "A flat discount on your purchase." },
    benefit: { type: "amountOff", amountCents: 500000, refs: [] },
    costPreset: { pointsCost: 200 },
  },
  {
    key: "percent-category",
    type: "percentOff",
    name: { es: "% en una categoría", en: "% off a category" },
    icon: "🏷️",
    backgroundCss: "linear-gradient(135deg, #3b73d6, #1f3a8a)",
    description: { es: "Un porcentaje de descuento en una categoría.", en: "A percent off a category." },
    benefit: { type: "percentOff", percent: 20, refs: [], maxDiscountCents: 800000 },
    costPreset: { pointsCost: 150 },
  },
  {
    key: "fast-track",
    type: "experience",
    name: { es: "Fast track", en: "Fast track" },
    icon: "⚡",
    backgroundCss: "linear-gradient(135deg, #fbbf24, #b45309)",
    description: { es: "Sáltate la fila con tu próxima orden.", en: "Skip the line on your next order." },
    benefit: { type: "experience" },
    costPreset: { stampsRequired: 6 },
    fulfillmentNote: "Atiende a este cliente sin fila.",
  },
];

export type RewardTemplateKey = (typeof REWARD_TEMPLATES)[number]["key"];

export const rewardTemplate = (key: string): RewardTemplate | null =>
  REWARD_TEMPLATES.find((t) => t.key === key) ?? null;
