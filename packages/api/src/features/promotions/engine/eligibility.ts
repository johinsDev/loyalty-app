import type { CustomerFacts, IneligibleReason, PromoView } from "./types";
import { isScheduleActiveAt } from "./schedule";

const DAY_MS = 86_400_000;

/** Customer/time eligibility (cart-independent). Returns null when eligible,
 *  else the first failing reason. Cart checks live in `evaluatePromo`. */
export function ineligibleReason(
  view: PromoView,
  facts: CustomerFacts,
  now: Date,
): IneligibleReason | null {
  if (view.status !== "published") return "not-published";
  if (view.startsAt && now < view.startsAt) return "outside-window";
  if (view.endsAt && now > view.endsAt) return "outside-window";
  if (!isScheduleActiveAt(view.schedule, now)) return "schedule-inactive";

  if (view.audienceType === "tier" && facts.customerTierKey !== view.tierKey) return "wrong-tier";
  if (
    view.audienceType === "specific" &&
    !(view.audienceCustomerIds ?? []).includes(facts.customerId)
  )
    return "not-targeted";

  const c = view.conditions ?? {};
  const pc = c.purchaseCount;
  if (pc) {
    if (pc.min != null && facts.customerPurchaseCount < pc.min)
      return "purchase-count-out-of-range";
    if (pc.max != null && facts.customerPurchaseCount > pc.max)
      return "purchase-count-out-of-range";
  }
  // Customers with no purchases at all count as dormant (eligible).
  if (c.lastPurchaseOlderThanDays != null && facts.customerLastPurchaseAt) {
    const ageDays = (now.getTime() - facts.customerLastPurchaseAt.getTime()) / DAY_MS;
    if (ageDays < c.lastPurchaseOlderThanDays) return "last-purchase-too-recent";
  }
  if (c.maxUsesTotal != null && facts.redemptionsTotal >= c.maxUsesTotal)
    return "max-uses-reached";
  if (c.maxPerCustomer != null && facts.redemptionsByCustomer >= c.maxPerCustomer)
    return "max-per-customer-reached";

  return null;
}

export const isEligible = (view: PromoView, facts: CustomerFacts, now: Date): boolean =>
  ineligibleReason(view, facts, now) === null;
