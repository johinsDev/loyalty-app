import type { PromoConditions, PromoRule, PromoSchedule } from "@loyalty/db/schema";

import type { PromoType } from "./schemas";

/**
 * Curated promo templates for the pre-wizard gallery. Typed code constants
 * (like `points/config.ts`): each preseed makes the draft essentially
 * publishable out of the box — catalog-specific refs are left empty (= any
 * item) so the owner narrows them in the benefit step if she wants.
 */

export interface PromoTemplate {
  key: string;
  type: PromoType;
  name: { es: string; en: string };
  badgeLabel: string;
  backgroundCss: string;
  shortDescription: { es: string; en: string };
  rule: PromoRule;
  schedule?: PromoSchedule;
  conditions?: PromoConditions;
}

export const PROMO_TEMPLATES: PromoTemplate[] = [
  {
    key: "two-for-one",
    type: "nxm",
    name: { es: "2×1 entre semana", en: "Weekday 2-for-1" },
    badgeLabel: "2×1",
    backgroundCss: "linear-gradient(135deg, #1BAD9D, #0e6f64)",
    shortDescription: {
      es: "Lleva dos y paga uno: el más barato va por nuestra cuenta.",
      en: "Buy two, pay one — the cheapest is on us.",
    },
    rule: {
      buy: { requirements: [{ refs: [], qty: 2 }] },
      effect: { kind: "freeUnits", count: 1, target: "buy" },
    },
    schedule: { recurrence: { kind: "weekly", days: [1, 2, 3, 4, 5] } },
  },
  {
    key: "happy-hour",
    type: "percentOff",
    name: { es: "Happy hour", en: "Happy hour" },
    badgeLabel: "-20%",
    backgroundCss: "linear-gradient(135deg, #f0a868, #e0467c)",
    shortDescription: {
      es: "20% de descuento en la franja valle de la tarde.",
      en: "20% off during the afternoon off-peak window.",
    },
    rule: {
      buy: { requirements: [] },
      effect: { kind: "percentOff", percent: 20, target: "order" },
    },
    schedule: { timeWindow: { from: "15:00", to: "17:00" } },
  },
  {
    key: "second-unit-50",
    type: "secondUnit",
    name: { es: "Segunda unidad al 50%", en: "Second unit 50% off" },
    badgeLabel: "2.ª -50%",
    backgroundCss: "linear-gradient(135deg, #e0467c, #7c2249)",
    shortDescription: {
      es: "Compra una y la segunda (la de menor valor) va a mitad de precio.",
      en: "Buy one, get the second (cheapest) at half price.",
    },
    rule: {
      buy: { requirements: [{ refs: [], qty: 2 }] },
      effect: {
        kind: "percentOff",
        percent: 50,
        target: "buy",
        select: { count: 1, pick: "cheapest" },
      },
    },
  },
  {
    key: "fixed-combo",
    type: "combo",
    name: { es: "Combo a precio fijo", en: "Fixed-price combo" },
    badgeLabel: "Combo",
    backgroundCss: "linear-gradient(135deg, #3b73d6, #1f3a8a)",
    shortDescription: {
      es: "Dos productos por un precio cerrado, más barato que por separado.",
      en: "Two items for one closed price, cheaper than separately.",
    },
    rule: {
      buy: { requirements: [{ refs: [], qty: 2 }] },
      effect: { kind: "fixedPrice", priceCents: 2500000 },
    },
  },
  {
    key: "spend-threshold",
    type: "cartThreshold",
    name: { es: "Descuento por monto", en: "Spend & save" },
    badgeLabel: "-$5K",
    backgroundCss: "linear-gradient(135deg, #0e6f64, #1BAD9D)",
    shortDescription: {
      es: "Descuento directo en compras desde un monto mínimo.",
      en: "Instant discount on purchases above a minimum.",
    },
    rule: {
      buy: { requirements: [], minSubtotalCents: 5000000 },
      effect: { kind: "amountOff", amountCents: 500000, target: "order" },
      maxApplicationsPerOrder: 1,
    },
  },
  {
    key: "win-back",
    type: "percentOff",
    name: { es: "Te extrañamos", en: "We miss you" },
    badgeLabel: "-15%",
    backgroundCss: "radial-gradient(at 20% 25%, #7c5cff 0, transparent 50%), #1f2937",
    shortDescription: {
      es: "15% para clientes que no compran hace más de 60 días.",
      en: "15% off for customers dormant for 60+ days.",
    },
    rule: {
      buy: { requirements: [] },
      effect: { kind: "percentOff", percent: 15, target: "order" },
    },
    conditions: { lastPurchaseOlderThanDays: 60, maxPerCustomer: 1 },
  },
  {
    key: "first-purchase",
    type: "percentOff",
    name: { es: "Primera compra", en: "First purchase" },
    badgeLabel: "-15%",
    backgroundCss: "linear-gradient(135deg, #7c5cff, #4527a0)",
    shortDescription: {
      es: "Descuento de bienvenida en la primera compra.",
      en: "Welcome discount on the first purchase.",
    },
    rule: {
      buy: { requirements: [] },
      effect: { kind: "percentOff", percent: 15, target: "order" },
    },
    conditions: { purchaseCount: { max: 0 }, maxPerCustomer: 1 },
  },
  {
    key: "welcome-gift",
    type: "crossSell",
    name: { es: "Regalo de bienvenida", en: "Welcome gift" },
    badgeLabel: "Gratis",
    backgroundCss: "radial-gradient(at 80% 20%, #1BAD9D 0, transparent 55%), #111827",
    shortDescription: {
      es: "Un producto de regalo en la primera compra.",
      en: "A free item with the first purchase.",
    },
    rule: {
      buy: { requirements: [] },
      get: { requirements: [{ refs: [], qty: 1 }] },
      effect: { kind: "percentOff", percent: 100, target: "get" },
      maxApplicationsPerOrder: 1,
    },
    conditions: { purchaseCount: { max: 0 }, maxPerCustomer: 1 },
  },
  {
    key: "double-points",
    type: "pointsMultiplier",
    name: { es: "Doble puntos", en: "Double points" },
    badgeLabel: "x2",
    backgroundCss: "linear-gradient(135deg, #3b73d6, #1f3a8a)",
    shortDescription: {
      es: "El doble de puntos en toda la compra, el fin de semana.",
      en: "Double points on every purchase, all weekend.",
    },
    rule: {
      buy: { requirements: [] },
      effect: { kind: "pointsMultiplier", multiplier: 2 },
    },
    schedule: { recurrence: { kind: "weekly", days: [0, 6] } },
  },
  {
    key: "volume-tiers",
    type: "volumeTiered",
    name: { es: "Compra más, ahorra más", en: "Buy more, save more" },
    badgeLabel: "-25%",
    backgroundCss: "linear-gradient(135deg, #f59e0b, #b45309)",
    shortDescription: {
      es: "5% llevando 1, 15% llevando 3, 25% llevando 5 o más.",
      en: "5% for 1, 15% for 3, 25% for 5 or more.",
    },
    rule: {
      buy: { requirements: [{ refs: [], qty: 1 }] },
      effect: {
        kind: "tieredPercent",
        tiers: [
          { minQty: 1, percent: 5 },
          { minQty: 3, percent: 15 },
          { minQty: 5, percent: 25 },
        ],
      },
    },
  },
  {
    key: "cross-sell-addon",
    type: "crossSell",
    name: { es: "Adicional a mitad de precio", en: "Add-on at half price" },
    badgeLabel: "-50%",
    backgroundCss: "linear-gradient(135deg, #10b981, #065f46)",
    shortDescription: {
      es: "Compra un producto y lleva el adicional al 50%.",
      en: "Buy one item and get the add-on at 50% off.",
    },
    rule: {
      buy: { requirements: [{ refs: [], qty: 1 }] },
      get: { requirements: [{ refs: [], qty: 1 }] },
      effect: { kind: "percentOff", percent: 50, target: "get" },
      maxApplicationsPerOrder: 1,
    },
  },
  {
    key: "match-day",
    type: "secondUnit",
    name: { es: "Día de partido", en: "Match day" },
    badgeLabel: "2.ª -50%",
    backgroundCss: "linear-gradient(135deg, #fbbf24, #1d4ed8 70%, #b91c1c)",
    shortDescription: {
      es: "Cuando juega la selección: la segunda bebida al 50%. Agrega las fechas de los partidos.",
      en: "When the national team plays: second drink 50% off. Add the match dates.",
    },
    rule: {
      buy: { requirements: [{ refs: [], qty: 2 }] },
      effect: {
        kind: "percentOff",
        percent: 50,
        target: "buy",
        select: { count: 1, pick: "cheapest" },
      },
    },
  },
];

export type PromoTemplateKey = (typeof PROMO_TEMPLATES)[number]["key"];

export const promoTemplate = (key: string): PromoTemplate | null =>
  PROMO_TEMPLATES.find((t) => t.key === key) ?? null;
