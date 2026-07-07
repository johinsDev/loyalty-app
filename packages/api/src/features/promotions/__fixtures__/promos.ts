import type { Cart, CartLine, CustomerFacts, PromoView } from "../engine";

export const line = (
  over: Partial<CartLine> & Pick<CartLine, "productId" | "unitAmountCents">,
): CartLine => ({ qty: 1, ...over });

export const cart = (...lines: CartLine[]): Cart => ({ currency: "COP", lines });

export const facts = (over: Partial<CustomerFacts> = {}): CustomerFacts => ({
  customerId: "cust-1",
  customerTierKey: null,
  customerPurchaseCount: 5,
  customerLastPurchaseAt: null,
  redemptionsTotal: 0,
  redemptionsByCustomer: 0,
  ...over,
});

export const view = (over: Partial<PromoView> = {}): PromoView => ({
  status: "published",
  startsAt: null,
  endsAt: null,
  rule: null,
  schedule: null,
  conditions: null,
  audienceType: "all",
  tierKey: null,
  audienceCustomerIds: null,
  ...over,
});

/** Monday 2026-07-06 15:00 in Bogota (20:00 UTC). */
export const NOW = new Date("2026-07-06T20:00:00Z");
