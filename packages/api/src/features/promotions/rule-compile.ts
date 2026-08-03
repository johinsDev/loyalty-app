import type { PromoLineRequirement, PromoRule } from "@loyalty/db/schema";
import { z } from "zod";

import { itemRefSchema, lineRequirementSchema, type ItemRef, type PromoType } from "./schemas";

/**
 * Bridge between the 10 curated wizard types and the generic rule model. Each
 * type exposes a small, human-shaped config; `compileRule` lowers it to a
 * `PromoRule` and `decompileRule` lifts a stored rule back into the config so
 * the benefit-step form can rehydrate. The rule stays the single source of
 * truth — configs are never persisted.
 */

const refsSchema = z.array(itemRefSchema);
const requirementsSchema = z.array(lineRequirementSchema);
const percentSchema = z.number().min(0.01).max(100);
const centsSchema = z.number().int().min(1);
const maxAppsSchema = z.number().int().min(1).optional();
/** Only on the types that discount matched units — an order-wide effect prices
 *  the whole ticket, so the toggle would be a knob that does nothing. */
const addonScope = { discountAddons: z.boolean().optional() };
/** Only on the types whose requirement consumes more than one unit — with qty 1
 *  there is no second unit for "the same product" to constrain. */
const sameItemScope = { sameItem: z.boolean().optional() };

const moneyBenefitSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("percent"),
    percent: percentSchema,
    maxDiscountCents: centsSchema.optional(),
  }),
  z.object({ kind: z.literal("amount"), amountCents: centsSchema }),
]);
type MoneyBenefit = z.infer<typeof moneyBenefitSchema>;

export const benefitConfigSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("percentOff"),
    refs: refsSchema, // [] = whole order
    percent: percentSchema,
    maxDiscountCents: centsSchema.optional(),
    ...addonScope,
  }),
  z.object({
    type: z.literal("amountOff"),
    refs: refsSchema,
    amountCents: centsSchema,
    ...addonScope,
  }),
  z.object({
    type: z.literal("nxm"),
    ...sameItemScope,
    refs: refsSchema, // [] = any item
    buyQty: z.number().int().min(2),
    payQty: z.number().int().min(1),
    maxApplicationsPerOrder: maxAppsSchema,
    ...addonScope,
  }),
  z.object({
    type: z.literal("secondUnit"),
    ...sameItemScope,
    refs: refsSchema,
    percent: percentSchema, // discount on the cheapest of the pair
    maxApplicationsPerOrder: maxAppsSchema,
    ...addonScope,
  }),
  z.object({
    type: z.literal("bundle"),
    requirements: requirementsSchema.min(1),
    benefit: moneyBenefitSchema,
    maxApplicationsPerOrder: maxAppsSchema,
    ...addonScope,
  }),
  z.object({
    type: z.literal("combo"),
    ...sameItemScope,
    requirements: requirementsSchema.min(1),
    priceCents: centsSchema,
    maxApplicationsPerOrder: maxAppsSchema,
    ...addonScope,
  }),
  z.object({
    type: z.literal("crossSell"),
    buy: requirementsSchema, // [] = no purchase requirement (e.g. welcome gift)
    get: requirementsSchema.min(1),
    percent: percentSchema, // 100 = free
    maxApplicationsPerOrder: maxAppsSchema, // compile defaults it to 1
    ...addonScope,
  }),
  z.object({
    type: z.literal("cartThreshold"),
    minSubtotalCents: centsSchema,
    benefit: moneyBenefitSchema,
  }),
  z.object({
    type: z.literal("volumeTiered"),
    refs: refsSchema,
    tiers: z
      .array(z.object({ minQty: z.number().int().min(1), percent: percentSchema }))
      .min(1),
    ...addonScope,
  }),
  z.object({
    type: z.literal("pointsMultiplier"),
    refs: refsSchema, // [] = whole order
    multiplier: z.number().min(1.01).max(10),
  }),
]).superRefine((v, ctx) => {
  if (v.type === "nxm" && v.payQty >= v.buyQty)
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "payQty must be below buyQty",
      path: ["payQty"],
    });
});
export type BenefitConfig = z.infer<typeof benefitConfigSchema>;

const scopedRequirements = (refs: ItemRef[]): PromoLineRequirement[] =>
  refs.length > 0 ? [{ refs, qty: 1 }] : [];

const moneyEffect = (b: MoneyBenefit, target: "buy" | "order"): PromoRule["effect"] =>
  b.kind === "percent"
    ? {
        kind: "percentOff",
        percent: b.percent,
        target,
        ...(b.maxDiscountCents != null ? { maxDiscountCents: b.maxDiscountCents } : {}),
      }
    : { kind: "amountOff", amountCents: b.amountCents, target };

export function compileRule(config: BenefitConfig): PromoRule {
  const rule = compileShape(config);
  // Attached once here rather than at each of the eight return sites: it is a
  // property of the offer, not of any particular type's shape. Only written
  // when true, so a stored rule stays as small as it was.
  return {
    ...rule,
    ...("discountAddons" in config && config.discountAddons === true
      ? { discountAddons: true as const }
      : {}),
    ...("sameItem" in config && config.sameItem === true ? { sameItem: true as const } : {}),
  };
}

function compileShape(config: BenefitConfig): PromoRule {
  switch (config.type) {
    case "percentOff":
      return {
        buy: { requirements: scopedRequirements(config.refs) },
        effect: {
          kind: "percentOff",
          percent: config.percent,
          target: config.refs.length > 0 ? "buy" : "order",
          ...(config.maxDiscountCents != null
            ? { maxDiscountCents: config.maxDiscountCents }
            : {}),
        },
      };
    case "amountOff":
      return {
        buy: { requirements: scopedRequirements(config.refs) },
        effect: {
          kind: "amountOff",
          amountCents: config.amountCents,
          target: config.refs.length > 0 ? "buy" : "order",
        },
      };
    case "nxm":
      return {
        buy: { requirements: [{ refs: config.refs, qty: config.buyQty }] },
        effect: { kind: "freeUnits", count: config.buyQty - config.payQty, target: "buy" },
        ...(config.maxApplicationsPerOrder != null
          ? { maxApplicationsPerOrder: config.maxApplicationsPerOrder }
          : {}),
      };
    case "secondUnit":
      return {
        buy: { requirements: [{ refs: config.refs, qty: 2 }] },
        effect: {
          kind: "percentOff",
          percent: config.percent,
          target: "buy",
          select: { count: 1, pick: "cheapest" },
        },
        ...(config.maxApplicationsPerOrder != null
          ? { maxApplicationsPerOrder: config.maxApplicationsPerOrder }
          : {}),
      };
    case "bundle":
      return {
        buy: { requirements: config.requirements },
        effect: moneyEffect(config.benefit, "buy"),
        ...(config.maxApplicationsPerOrder != null
          ? { maxApplicationsPerOrder: config.maxApplicationsPerOrder }
          : {}),
      };
    case "combo":
      return {
        buy: { requirements: config.requirements },
        effect: { kind: "fixedPrice", priceCents: config.priceCents },
        ...(config.maxApplicationsPerOrder != null
          ? { maxApplicationsPerOrder: config.maxApplicationsPerOrder }
          : {}),
      };
    case "crossSell":
      return {
        buy: { requirements: config.buy },
        get: { requirements: config.get },
        effect: { kind: "percentOff", percent: config.percent, target: "get" },
        maxApplicationsPerOrder: config.maxApplicationsPerOrder ?? 1,
      };
    case "cartThreshold":
      return {
        buy: { requirements: [], minSubtotalCents: config.minSubtotalCents },
        effect: moneyEffect(config.benefit, "order"),
        maxApplicationsPerOrder: 1,
      };
    case "volumeTiered":
      return {
        buy: { requirements: [{ refs: config.refs, qty: 1 }] },
        effect: { kind: "tieredPercent", tiers: config.tiers },
      };
    case "pointsMultiplier":
      return {
        buy: { requirements: scopedRequirements(config.refs) },
        effect: { kind: "pointsMultiplier", multiplier: config.multiplier },
      };
    default:
      throw new Error("Unknown benefit config");
  }
}

/** Lift a stored rule back into its type's config (compile's inverse for the
 *  10 curated shapes). Returns null when the rule doesn't fit the type. */
export function decompileRule(type: PromoType, rule: PromoRule): BenefitConfig | null {
  const config = decompileShape(type, rule);
  // Lift the flag back too, or reopening the wizard would silently drop it and
  // republish the promo no longer covering add-ons. Guarded by type: the
  // order-wide shapes don't carry the field at all.
  if (config == null) return config;
  const lifted = {
    ...config,
    ...(rule.discountAddons === true && ADDON_SCOPED.has(config.type)
      ? { discountAddons: true }
      : {}),
    ...(rule.sameItem === true && SAME_ITEM_SCOPED.has(config.type) ? { sameItem: true } : {}),
  };
  return lifted as BenefitConfig;
}

/** Types whose config accepts `discountAddons` — the ones that discount matched
 *  units rather than the whole ticket. */
/** Types whose config accepts `sameItem`. */
const SAME_ITEM_SCOPED = new Set<PromoType>(["nxm", "secondUnit", "combo"]);

const ADDON_SCOPED = new Set<PromoType>([
  "percentOff",
  "amountOff",
  "nxm",
  "secondUnit",
  "bundle",
  "combo",
  "crossSell",
  "volumeTiered",
]);

function decompileShape(type: PromoType, rule: PromoRule): BenefitConfig | null {
  const e = rule.effect;
  const firstReq = rule.buy.requirements[0];
  switch (type) {
    case "percentOff":
      if (e.kind !== "percentOff" || e.select) return null;
      return {
        type,
        refs: firstReq?.refs ?? [],
        percent: e.percent,
        maxDiscountCents: e.maxDiscountCents,
      };
    case "amountOff":
      if (e.kind !== "amountOff") return null;
      return { type, refs: firstReq?.refs ?? [], amountCents: e.amountCents };
    case "nxm": {
      if (e.kind !== "freeUnits" || !firstReq) return null;
      return {
        type,
        refs: firstReq.refs,
        buyQty: firstReq.qty,
        payQty: firstReq.qty - e.count,
        maxApplicationsPerOrder: rule.maxApplicationsPerOrder,
      };
    }
    case "secondUnit":
      if (e.kind !== "percentOff" || !e.select || !firstReq) return null;
      return {
        type,
        refs: firstReq.refs,
        percent: e.percent,
        maxApplicationsPerOrder: rule.maxApplicationsPerOrder,
      };
    case "bundle": {
      if (e.kind !== "percentOff" && e.kind !== "amountOff") return null;
      const benefit: MoneyBenefit =
        e.kind === "percentOff"
          ? { kind: "percent", percent: e.percent, maxDiscountCents: e.maxDiscountCents }
          : { kind: "amount", amountCents: e.amountCents };
      return {
        type,
        requirements: rule.buy.requirements,
        benefit,
        maxApplicationsPerOrder: rule.maxApplicationsPerOrder,
      };
    }
    case "combo":
      if (e.kind !== "fixedPrice") return null;
      return {
        type,
        requirements: rule.buy.requirements,
        priceCents: e.priceCents,
        maxApplicationsPerOrder: rule.maxApplicationsPerOrder,
      };
    case "crossSell":
      if (e.kind !== "percentOff" || !rule.get) return null;
      return {
        type,
        buy: rule.buy.requirements,
        get: rule.get.requirements,
        percent: e.percent,
        maxApplicationsPerOrder: rule.maxApplicationsPerOrder ?? 1,
      };
    case "cartThreshold": {
      if (rule.buy.minSubtotalCents == null) return null;
      if (e.kind !== "percentOff" && e.kind !== "amountOff") return null;
      const benefit: MoneyBenefit =
        e.kind === "percentOff"
          ? { kind: "percent", percent: e.percent, maxDiscountCents: e.maxDiscountCents }
          : { kind: "amount", amountCents: e.amountCents };
      return { type, minSubtotalCents: rule.buy.minSubtotalCents, benefit };
    }
    case "volumeTiered":
      if (e.kind !== "tieredPercent") return null;
      return { type, refs: firstReq?.refs ?? [], tiers: e.tiers };
    case "pointsMultiplier":
      if (e.kind !== "pointsMultiplier") return null;
      return { type, refs: firstReq?.refs ?? [], multiplier: e.multiplier };
    default:
      return null;
  }
}
