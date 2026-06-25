import type { PromoBenefit, PromoConditions, PromoScope } from "@loyalty/db/schema";

// Pure promo engine: discount computation + eligibility. No db/io — the service
// feeds it plain data so it stays unit-testable.

/** A checkout line (price snapshot). `categoryIds` lets category-scoped promos
 *  match without another lookup. */
export interface CartLine {
  productId: string;
  variantId?: string | null;
  modifierOptionIds?: string[];
  categoryIds?: string[];
  qty: number;
  unitAmountCents: number;
}
export interface Cart {
  currency: string;
  lines: CartLine[];
}

export interface PromoLike {
  type: string | null;
  benefit: PromoBenefit | null;
  scopeKind: string | null;
  scope: PromoScope | null;
  conditions: PromoConditions | null;
}

export interface DiscountResult {
  discountCents: number;
  /** >1 when a pointsMultiplier promo applies (no monetary discount). */
  pointsMultiplier: number;
}

const subtotal = (lines: CartLine[]) =>
  lines.reduce((s, l) => s + l.unitAmountCents * l.qty, 0);

/** Lines a promo applies to, per its scope. */
export function scopedLines(cart: Cart, promo: PromoLike): CartLine[] {
  if (promo.scopeKind === "products") {
    const ids = new Set(promo.scope?.productIds ?? []);
    return cart.lines.filter((l) => ids.has(l.productId));
  }
  if (promo.scopeKind === "categories") {
    const ids = new Set(promo.scope?.categoryIds ?? []);
    return cart.lines.filter((l) => (l.categoryIds ?? []).some((c) => ids.has(c)));
  }
  return cart.lines; // order
}

/** Expand lines into individual unit prices (for NxN / cheapest-free). */
function units(lines: CartLine[]): number[] {
  const out: number[] = [];
  for (const l of lines) for (let i = 0; i < l.qty; i++) out.push(l.unitAmountCents);
  return out;
}

/**
 * Compute the monetary discount (and points multiplier) for a promo against a
 * cart. Returns 0 discount when nothing in scope or the type doesn't discount.
 */
export function computeDiscount(cart: Cart, promo: PromoLike): DiscountResult {
  const none: DiscountResult = { discountCents: 0, pointsMultiplier: 1 };
  const scoped = scopedLines(cart, promo);
  const b = promo.benefit;
  if (!b) return none;

  switch (promo.type) {
    case "percentage": {
      if (!("percent" in b)) return none;
      const base = subtotal(scoped);
      let d = Math.round((base * b.percent) / 100);
      const cap = b.maxDiscountCents ?? promo.conditions?.maxDiscountCents;
      if (cap != null) d = Math.min(d, cap);
      return { discountCents: Math.max(0, d), pointsMultiplier: 1 };
    }
    case "fixed": {
      if (!("amountCents" in b)) return none;
      return { discountCents: Math.min(b.amountCents, subtotal(scoped)), pointsMultiplier: 1 };
    }
    case "nForM": {
      if (!("buyQty" in b) || b.buyQty <= 0 || b.payQty >= b.buyQty) return none;
      const u = units(scoped).sort((a, c) => a - c); // cheapest first
      const groups = Math.floor(u.length / b.buyQty);
      const freeCount = groups * (b.buyQty - b.payQty);
      const discount = u.slice(0, freeCount).reduce((s, c) => s + c, 0);
      return { discountCents: discount, pointsMultiplier: 1 };
    }
    case "freeItem": {
      if (!("freeRef" in b)) return none;
      // The referenced item is free: discount the cheapest matching unit present.
      const ref = b.freeRef;
      const matches = cart.lines.filter((l) =>
        ref.kind === "product"
          ? l.productId === ref.id
          : ref.kind === "variant"
            ? l.variantId === ref.id
            : (l.modifierOptionIds ?? []).includes(ref.id),
      );
      if (matches.length === 0) return none;
      const cheapest = Math.min(...matches.map((l) => l.unitAmountCents));
      return { discountCents: cheapest, pointsMultiplier: 1 };
    }
    case "pointsMultiplier": {
      if (!("multiplier" in b)) return none;
      return { discountCents: 0, pointsMultiplier: b.multiplier };
    }
    default:
      return none;
  }
}

// ── Eligibility ─────────────────────────────────────────────────────────────

export interface EligibilityContext {
  now: Date;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  audienceType: string; // all | tier | specific
  tierKey: string | null;
  audienceCustomerIds: string[] | null;
  conditions: PromoConditions | null;
  /** Customer facts. */
  customerTierKey: string | null;
  customerId: string;
  customerPurchaseCount: number;
  redemptionsTotal: number;
  redemptionsByCustomer: number;
  /** Cart facts (optional — when evaluating at checkout). */
  cart?: Cart;
  scopeKind?: string | null;
  scope?: PromoScope | null;
}

export type IneligibleReason =
  | "not-published"
  | "outside-window"
  | "wrong-day"
  | "outside-hours"
  | "wrong-tier"
  | "not-targeted"
  | "not-first-purchase"
  | "max-uses-reached"
  | "max-per-customer-reached"
  | "below-min-purchase"
  | "no-scoped-items";

function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}
function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Returns null when eligible, else the first failing reason. */
export function ineligibleReason(ctx: EligibilityContext): IneligibleReason | null {
  if (ctx.status !== "published") return "not-published";
  if (ctx.startsAt && ctx.now < ctx.startsAt) return "outside-window";
  if (ctx.endsAt && ctx.now > ctx.endsAt) return "outside-window";

  const c = ctx.conditions ?? {};
  if (c.daysOfWeek && c.daysOfWeek.length > 0 && !c.daysOfWeek.includes(ctx.now.getDay()))
    return "wrong-day";
  if (c.hoursFrom && c.hoursTo) {
    const t = minutesOfDay(ctx.now);
    if (t < parseHm(c.hoursFrom) || t > parseHm(c.hoursTo)) return "outside-hours";
  }

  if (ctx.audienceType === "tier" && ctx.customerTierKey !== ctx.tierKey) return "wrong-tier";
  if (ctx.audienceType === "specific" && !(ctx.audienceCustomerIds ?? []).includes(ctx.customerId))
    return "not-targeted";

  if (c.firstPurchaseOnly && ctx.customerPurchaseCount > 0) return "not-first-purchase";
  if (c.maxUsesTotal != null && ctx.redemptionsTotal >= c.maxUsesTotal) return "max-uses-reached";
  if (c.maxPerCustomer != null && ctx.redemptionsByCustomer >= c.maxPerCustomer)
    return "max-per-customer-reached";

  if (ctx.cart) {
    if (c.minPurchaseCents != null) {
      const sub = subtotal(ctx.cart.lines);
      if (sub < c.minPurchaseCents) return "below-min-purchase";
    }
    const scopedCount = scopedLines(ctx.cart, {
      type: null,
      benefit: null,
      scopeKind: ctx.scopeKind ?? "order",
      scope: ctx.scope ?? null,
      conditions: null,
    }).length;
    if (scopedCount === 0) return "no-scoped-items";
  }

  return null;
}

export const isEligible = (ctx: EligibilityContext): boolean => ineligibleReason(ctx) === null;
