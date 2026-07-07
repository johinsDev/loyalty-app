import { z } from "zod";

import { listQueryBase } from "../_shared/list";

// ─── Enums ───────────────────────────────────────────────────────────────────
export const promoStatusSchema = z.enum(["draft", "published", "archived"]);
export const promoTypeSchema = z.enum([
  "percentOff",
  "amountOff",
  "nxm",
  "secondUnit",
  "bundle",
  "combo",
  "crossSell",
  "cartThreshold",
  "volumeTiered",
  "pointsMultiplier",
]);
export type PromoType = z.infer<typeof promoTypeSchema>;
export const audienceTypeSchema = z.enum(["all", "tier", "specific"]);
export const tierKeySchema = z.enum(["hoja", "flor", "oro"]);

// ─── Rule (generic trigger → effect model) ──────────────────────────────────
export const itemRefSchema = z.object({
  kind: z.enum(["product", "variant", "category", "modifierOption"]),
  id: z.string().min(1),
});
export type ItemRef = z.infer<typeof itemRefSchema>;

/** N units matching ANY of `refs` (empty refs = any unit in the cart). */
export const lineRequirementSchema = z.object({
  refs: z.array(itemRefSchema),
  qty: z.number().int().min(1),
});

export const triggerSchema = z.object({
  requirements: z.array(lineRequirementSchema).default([]),
  minSubtotalCents: z.number().int().min(1).optional(),
});

export const effectTargetSchema = z.enum(["buy", "get", "order"]);

export const effectSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("percentOff"),
    percent: z.number().min(0.01).max(100),
    target: effectTargetSchema,
    select: z
      .object({ count: z.number().int().min(1), pick: z.literal("cheapest") })
      .optional(),
    maxDiscountCents: z.number().int().min(1).optional(),
  }),
  z.object({
    kind: z.literal("amountOff"),
    amountCents: z.number().int().min(1),
    target: effectTargetSchema,
  }),
  z.object({ kind: z.literal("fixedPrice"), priceCents: z.number().int().min(1) }),
  z.object({
    kind: z.literal("freeUnits"),
    count: z.number().int().min(1),
    target: effectTargetSchema,
  }),
  z.object({
    kind: z.literal("tieredPercent"),
    tiers: z
      .array(z.object({ minQty: z.number().int().min(1), percent: z.number().min(0.01).max(100) }))
      .min(1),
  }),
  z.object({
    kind: z.literal("pointsMultiplier"),
    multiplier: z.number().min(1.01).max(10),
  }),
]);

export const ruleSchema = z.object({
  buy: triggerSchema,
  get: z.object({ requirements: z.array(lineRequirementSchema).min(1) }).optional(),
  effect: effectSchema,
  maxApplicationsPerOrder: z.number().int().min(1).optional(),
});
export type RuleInput = z.infer<typeof ruleSchema>;

// ─── Schedule (recurrence DSL, org-local time) ──────────────────────────────
const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const recurrenceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("weekly"),
    days: z.array(z.number().int().min(0).max(6)).min(1),
  }),
  z.object({ kind: z.literal("monthlyDay"), day: z.number().int().min(1).max(31) }),
  z.object({
    kind: z.literal("monthlyNthWeekday"),
    nth: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(-1)]),
    weekday: z.number().int().min(0).max(6),
  }),
  z.object({ kind: z.literal("dates"), dates: z.array(isoDate).min(1) }),
]);

export const scheduleSchema = z.object({
  recurrence: recurrenceSchema.optional(),
  timeWindow: z.object({ from: hhmm, to: hhmm }).optional(),
  excludedDates: z.array(isoDate).optional(),
});
export type ScheduleInput = z.infer<typeof scheduleSchema>;

// ─── Conditions v2 ───────────────────────────────────────────────────────────
export const conditionsSchema = z.object({
  minPurchaseCents: z.number().int().min(1).optional(),
  maxUsesTotal: z.number().int().min(1).optional(),
  maxPerCustomer: z.number().int().min(1).optional(),
  lastPurchaseOlderThanDays: z.number().int().min(1).optional(),
  purchaseCount: z
    .object({ min: z.number().int().min(0).optional(), max: z.number().int().min(0).optional() })
    .optional(),
});
export type ConditionsInput = z.infer<typeof conditionsSchema>;

// ─── Admin IO ────────────────────────────────────────────────────────────────
export const idInputSchema = z.object({ id: z.string().uuid() });
export const slugInputSchema = z.object({ slug: z.string().min(1) });

/** Post-publish edits: design/copy only — mechanics are immutable once live. */
export const patchContentSchema = z.object({
  id: z.string().uuid(),
  shortDescription: z.string().max(280).optional(),
  longDescription: z.string().optional(),
  badgeLabel: z.string().max(24).optional(),
  icon: z.string().max(60).optional(),
  backgroundCss: z.string().max(4096).optional(),
  mainImageUrl: z.string().url().optional().or(z.literal("")),
  category: z.string().max(60).optional(),
  featured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
export type PatchContentInput = z.infer<typeof patchContentSchema>;

export const promoVigencySchema = z.enum(["active", "scheduled", "expired"]);
export type PromoVigency = z.infer<typeof promoVigencySchema>;

export const adminListInputSchema = listQueryBase.extend({
  status: z.array(promoStatusSchema).optional(),
  vigency: z.array(promoVigencySchema).optional(),
  type: z.array(promoTypeSchema).optional(),
  audience: z.array(audienceTypeSchema).optional(),
  startsFrom: z.coerce.date().optional(),
  startsTo: z.coerce.date().optional(),
});
export type AdminListInput = z.infer<typeof adminListInputSchema>;

// ─── Customer browse IO ──────────────────────────────────────────────────────
export const publicListInputSchema = z.object({
  category: z.string().optional(),
  cursor: z.string().nullish(),
  pageSize: z.number().int().min(1).max(40).default(12),
});
export type PublicListInput = z.infer<typeof publicListInputSchema>;

// ─── Apply / checkout IO ─────────────────────────────────────────────────────
export const cartLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().nullish(),
  modifierOptionIds: z.array(z.string()).optional(),
  qty: z.number().int().min(1),
  unitAmountCents: z.number().int().min(0),
});
export const cartSchema = z.object({
  currency: z.string().default("COP"),
  lines: z.array(cartLineSchema),
});
export const applicableInputSchema = z.object({
  customerId: z.string().min(1),
  cart: cartSchema,
});

// ─── Outputs ─────────────────────────────────────────────────────────────────
export interface PromoCard {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  /** Auto-generated from the rule (locale-aware); shortDescription overrides. */
  benefitSummary: string | null;
  badgeLabel: string | null;
  icon: string | null;
  backgroundCss: string | null;
  mainImageUrl: string | null;
  category: string | null;
  featured: boolean;
}
export interface PromoDetail extends PromoCard {
  longDescription: string | null;
  type: string | null;
  seo: { title: string | null; description: string | null; ogImageUrl: string | null };
}
export interface ApplicablePromo {
  promo: PromoCard;
  discountCents: number;
  pointsMultiplier: number;
  /** How many times the rule applied to the cart. */
  applications: number;
}
export interface ApplicableHint {
  promo: PromoCard;
  /** Get-side refs missing from the cart — the POS upsell hint. */
  missingGetSide: ItemRef[];
}
export interface ApplicableResult {
  applicable: ApplicablePromo[];
  hints: ApplicableHint[];
}

// ─── Analytics ───────────────────────────────────────────────────────────────
export const promoAnalyticsInputSchema = z.object({ from: z.coerce.date().optional() });
export type PromoAnalyticsInput = z.infer<typeof promoAnalyticsInputSchema>;

/** One day of promo activity (org-local day, YYYY-MM-DD). */
export interface PromoStatPoint {
  day: string;
  uses: number;
  discountCents: number;
}
export interface PromoAnalyticsRow {
  id: string;
  name: string;
  slug: string;
  uses: number;
  discountCents: number;
  customers: number;
}
export interface PromoAnalytics {
  totals: {
    uses: number;
    /** Money given away across all applications. */
    discountCents: number;
    /** Net revenue collected on tickets that used a promo. */
    revenueCents: number;
    /** Distinct customers who redeemed at least one promo. */
    customers: number;
  };
  series: PromoStatPoint[];
  top: PromoAnalyticsRow[];
}
