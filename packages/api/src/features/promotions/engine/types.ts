import type { PromoConditions, PromoItemRef, PromoRule, PromoSchedule } from "@loyalty/db/schema";

// Pure promo engine: rule matching, effect computation and eligibility.
// No db/io — the service feeds it plain data so it stays unit-testable.

/** A checkout line (price snapshot). `categoryIds` and `modifierOptions` are
 *  stitched in by the service so the engine matches without extra lookups.
 *  `unitAmountCents` is the full unit price (modifier deltas included). */
export interface CartLine {
  productId: string;
  variantId?: string | null;
  modifierOptionIds?: string[];
  categoryIds?: string[];
  modifierOptions?: { id: string; priceDeltaCents: number }[];
  qty: number;
  unitAmountCents: number;
}

export interface Cart {
  currency: string;
  lines: CartLine[];
}

/** One matchable/discountable unit. Lines expand into `qty` product units plus
 *  one modifier unit per modifier option per qty (priced at its delta). */
export interface CartUnit {
  lineIndex: number;
  amountCents: number;
  source: "product" | "modifierOption";
  modifierOptionId?: string;
}

/** One application of a rule: the buy-side and get-side units it consumed. */
export interface RuleApplication {
  buyUnits: CartUnit[];
  getUnits: CartUnit[];
}

export interface MatchResult {
  applications: RuleApplication[];
  /** Buy-side was satisfiable at least once but these get-side refs were not
   *  in the cart — the POS upsell hint. */
  missingGetSide: PromoItemRef[];
}

export type IneligibleReason =
  | "not-published"
  | "outside-window"
  | "schedule-inactive"
  | "wrong-tier"
  | "not-targeted"
  | "purchase-count-out-of-range"
  | "last-purchase-too-recent"
  | "max-uses-reached"
  | "max-per-customer-reached"
  | "below-min-purchase"
  | "below-threshold"
  | "no-matching-items"
  | "missing-get-side";

/** Everything about a promo the engine needs (a projection of PromoRow). */
export interface PromoView {
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  rule: PromoRule | null;
  schedule: PromoSchedule | null;
  conditions: PromoConditions | null;
  audienceType: string; // all | tier | specific
  tierKey: string | null;
  audienceCustomerIds: string[] | null;
}

/** Customer + usage facts the service resolves before evaluating. */
export interface CustomerFacts {
  customerId: string;
  customerTierKey: string | null;
  customerPurchaseCount: number;
  customerLastPurchaseAt: Date | null;
  redemptionsTotal: number;
  redemptionsByCustomer: number;
}

export interface PromoEvaluation {
  eligible: boolean;
  reason: IneligibleReason | null;
  discountCents: number;
  /** >1 when a pointsMultiplier promo applies (no monetary discount). */
  pointsMultiplier: number;
  /** How many times the rule applied to this cart. */
  applications: number;
  /** Upsell hint: get-side refs missing from the cart (only set when the
   *  reason is "missing-get-side"). */
  missingGetSide: PromoItemRef[];
}

export const subtotalCents = (lines: CartLine[]): number =>
  lines.reduce((s, l) => s + l.unitAmountCents * l.qty, 0);
