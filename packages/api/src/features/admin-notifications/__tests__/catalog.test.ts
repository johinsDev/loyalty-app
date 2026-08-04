import { rolesAtOrAbove, ROLES } from "@loyalty/auth/server";
import { describe, expect, it } from "vitest";

import {
  ADMIN_ALERTS,
  ADMIN_ALERT_TYPES,
  isAdminAlertType,
  producesImmediateRow,
} from "../catalog";

describe("admin alert catalog", () => {
  it("declares every type exactly once", () => {
    expect(Object.keys(ADMIN_ALERTS).sort()).toEqual(
      [...ADMIN_ALERT_TYPES].sort(),
    );
  });

  it("only store-scoped alerts can be filtered by branch", () => {
    // An org-wide alert (a role change) must never carry a store, or scoping
    // the switcher to one shop would hide it.
    expect(ADMIN_ALERTS["staff-role-changed"].storeScoped).toBe(false);
    expect(ADMIN_ALERTS["points-adjusted"].storeScoped).toBe(true);
  });

  it("threshold types declare a threshold, others don't", () => {
    for (const type of ADMIN_ALERT_TYPES) {
      const def = ADMIN_ALERTS[type];
      if (def.delivery === "threshold") {
        expect(def.threshold, `${type} needs a threshold`).toBeGreaterThan(0);
      } else {
        expect(def.threshold, `${type} should not have one`).toBeUndefined();
      }
    }
  });

  it("narrows unknown strings", () => {
    expect(isAdminAlertType("points-adjusted")).toBe(true);
    expect(isAdminAlertType("nope")).toBe(false);
  });
});

describe("producesImmediateRow", () => {
  it("lets immediate alerts straight through", () => {
    expect(producesImmediateRow("customer-banned")).toBe(true);
  });

  it("keeps routine adjustments out of the inbox", () => {
    // The cashier fixing a stamp shouldn't ping the owner; the digest counts it.
    expect(producesImmediateRow("stamps-adjusted", 1)).toBe(false);
    expect(producesImmediateRow("points-adjusted", 50)).toBe(false);
  });

  it("raises a row once the change is big enough", () => {
    expect(producesImmediateRow("stamps-adjusted", 3)).toBe(true);
    expect(producesImmediateRow("points-adjusted", 500)).toBe(true);
  });

  it("treats a large deduction as loudly as a large gift", () => {
    // Taking 500 points off a customer is at least as suspicious as adding them.
    expect(producesImmediateRow("points-adjusted", -500)).toBe(true);
  });

  it("never fires for digest-only or cron types", () => {
    expect(producesImmediateRow("customer-signup", 9999)).toBe(false);
    expect(producesImmediateRow("daily-digest")).toBe(false);
  });

  it("skips a threshold alert with no magnitude rather than guessing", () => {
    expect(producesImmediateRow("points-adjusted")).toBe(false);
    expect(producesImmediateRow("points-adjusted", null)).toBe(false);
  });
});

describe("rolesAtOrAbove", () => {
  it("expands a role floor into the operator roles that clear it", () => {
    expect(rolesAtOrAbove(ROLES.owner)).toEqual(["owner"]);
    expect(rolesAtOrAbove(ROLES.manager)).toEqual(["manager", "owner"]);
    expect(rolesAtOrAbove(ROLES.staff)).toEqual(["staff", "manager", "owner"]);
  });

  it("never includes customers, even from the bottom of the ladder", () => {
    expect(rolesAtOrAbove(ROLES.customer)).not.toContain("customer");
  });
});
