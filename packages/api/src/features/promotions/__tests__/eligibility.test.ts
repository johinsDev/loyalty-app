import { describe, expect, it } from "vitest";

import { ineligibleReason } from "../engine";
import { facts, NOW, view } from "../__fixtures__/promos";

describe("ineligibleReason", () => {
  it("requires published status", () => {
    expect(ineligibleReason(view({ status: "draft" }), facts(), NOW)).toBe("not-published");
    expect(ineligibleReason(view({ status: "archived" }), facts(), NOW)).toBe("not-published");
    expect(ineligibleReason(view(), facts(), NOW)).toBeNull();
  });

  it("enforces the startsAt/endsAt window", () => {
    expect(
      ineligibleReason(view({ startsAt: new Date("2026-08-01T00:00:00Z") }), facts(), NOW),
    ).toBe("outside-window");
    expect(ineligibleReason(view({ endsAt: new Date("2026-07-01T00:00:00Z") }), facts(), NOW)).toBe(
      "outside-window",
    );
  });

  it("reports schedule-inactive from the DSL", () => {
    expect(
      ineligibleReason(
        view({ schedule: { recurrence: { kind: "weekly", days: [0] } } }),
        facts(),
        NOW,
      ),
    ).toBe("schedule-inactive");
  });

  it("gates by tier and by specific audience", () => {
    const tierPromo = view({ audienceType: "tier", tierKey: "oro" });
    expect(ineligibleReason(tierPromo, facts({ customerTierKey: "hoja" }), NOW)).toBe("wrong-tier");
    expect(ineligibleReason(tierPromo, facts({ customerTierKey: "oro" }), NOW)).toBeNull();

    const specific = view({ audienceType: "specific", audienceCustomerIds: ["vip-1"] });
    expect(ineligibleReason(specific, facts(), NOW)).toBe("not-targeted");
    expect(ineligibleReason(specific, facts({ customerId: "vip-1" }), NOW)).toBeNull();
  });

  it("bounds purchase count (min and max)", () => {
    const firstOnly = view({ conditions: { purchaseCount: { max: 0 } } });
    expect(ineligibleReason(firstOnly, facts({ customerPurchaseCount: 1 }), NOW)).toBe(
      "purchase-count-out-of-range",
    );
    expect(ineligibleReason(firstOnly, facts({ customerPurchaseCount: 0 }), NOW)).toBeNull();

    const loyalOnly = view({ conditions: { purchaseCount: { min: 10 } } });
    expect(ineligibleReason(loyalOnly, facts({ customerPurchaseCount: 9 }), NOW)).toBe(
      "purchase-count-out-of-range",
    );
  });

  it("enforces recency: recent buyers excluded, never-buyers count as dormant", () => {
    const winBack = view({ conditions: { lastPurchaseOlderThanDays: 60 } });
    const recent = facts({ customerLastPurchaseAt: new Date("2026-07-01T00:00:00Z") });
    const dormant = facts({ customerLastPurchaseAt: new Date("2026-01-01T00:00:00Z") });
    expect(ineligibleReason(winBack, recent, NOW)).toBe("last-purchase-too-recent");
    expect(ineligibleReason(winBack, dormant, NOW)).toBeNull();
    expect(ineligibleReason(winBack, facts({ customerLastPurchaseAt: null }), NOW)).toBeNull();
  });

  it("enforces usage limits", () => {
    expect(
      ineligibleReason(
        view({ conditions: { maxUsesTotal: 100 } }),
        facts({ redemptionsTotal: 100 }),
        NOW,
      ),
    ).toBe("max-uses-reached");
    expect(
      ineligibleReason(
        view({ conditions: { maxPerCustomer: 2 } }),
        facts({ redemptionsByCustomer: 2 }),
        NOW,
      ),
    ).toBe("max-per-customer-reached");
  });
});
