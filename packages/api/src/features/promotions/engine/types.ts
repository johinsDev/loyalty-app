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
  addonIds?: string[];
  categoryIds?: string[];
  modifierOptions?: { id: string; priceDeltaCents: number }[];
  /** Catalog add-ons on this line + their deltas (stitched for reward waiving). */
  addons?: { id: string; priceDeltaCents: number; name?: string }[];
  /** Where a reward could move this line's variant, and what the step costs.
   *  Resolved per-reward by the service (it needs the variant graph), so it is
   *  absent for every other benefit type. */
  upgradeTo?: { variantId: string; deltaCents: number } | null;
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
  /** What the customer pays for this unit, add-ons included. Ranks and selects
   *  units, because that is the price a cashier reads off the line. */
  amountCents: number;
  /**
   * What a promo may take off: the drink without its add-ons.
   *
   * `unitAmountCents` arrives with the add-ons folded in, so every scoped effect
   * used to discount them too. A fixed-price combo swallowed them whole — two
   * drinks at $15.500 carrying $3.000 of toppings each went to $28.000 flat, so
   * the toppings rode along free and nothing stopped a customer loading up.
   *
   * Spend thresholds and order-wide effects still use the full amount: the
   * customer did spend it.
   */
  discountableCents: number;
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
  /** Cart lines this promo actually lands on, so the register can say which
   *  drink is being discounted instead of an unattributed amount. Get-side
   *  units when the rule has one (they're what goes free/cheap), otherwise the
   *  buy side. Deduplicated, in cart order. */
  lineIndexes: number[];
  /** Of those lines, the ones the discount actually singles out — the free
   *  drink of a 3x2, the halved one of a pair. Empty when the effect covers
   *  everything it matched, because then there is nothing to point at. */
  discountedLineIndexes: number[];
}

export const subtotalCents = (lines: CartLine[]): number =>
  lines.reduce((s, l) => s + l.unitAmountCents * l.qty, 0);
