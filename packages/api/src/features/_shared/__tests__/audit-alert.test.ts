import { describe, expect, it, vi } from "vitest";

import {
  emitAdminAlert,
  recordAuditWithAlert,
  type AdminAlertPayload,
} from "../audit-alert";

vi.mock("@loyalty/db", () => ({ recordAudit: vi.fn(async () => {}) }));

const ORG = "org_1";

function spyEnqueue() {
  const calls: AdminAlertPayload[] = [];
  return {
    calls,
    enqueue: async (p: AdminAlertPayload) => {
      calls.push(p);
    },
  };
}

describe("recordAuditWithAlert", () => {
  it("alerts on a role change", async () => {
    const { calls, enqueue } = spyEnqueue();
    await recordAuditWithAlert(
      {
        organizationId: ORG,
        actorUserId: "owner_1",
        targetUserId: "emp_1",
        type: "role_change",
        metadata: { from: "staff", to: "manager" },
      },
      enqueue,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      organizationId: ORG,
      alertType: "staff-role-changed",
      actorUserId: "owner_1",
      entity: { type: "employee", id: "emp_1" },
    });
  });

  it("stays silent for audit types that aren't alerts", async () => {
    const { calls, enqueue } = spyEnqueue();
    // Logging in is for the activity log, not the owner's bell.
    await recordAuditWithAlert(
      { organizationId: ORG, type: "login" },
      enqueue,
    );
    await recordAuditWithAlert(
      { organizationId: ORG, type: "rating_change" },
      enqueue,
    );
    expect(calls).toHaveLength(0);
  });

  it("keeps small adjustments out of the inbox but lets big ones through", async () => {
    const { calls, enqueue } = spyEnqueue();
    await recordAuditWithAlert(
      {
        organizationId: ORG,
        type: "customer_points_adjust",
        metadata: { points: 20, reason: "fix" },
      },
      enqueue,
    );
    expect(calls).toHaveLength(0);

    await recordAuditWithAlert(
      {
        organizationId: ORG,
        targetUserId: "cust_1",
        type: "customer_points_adjust",
        metadata: { points: 500, reason: "compensación" },
      },
      enqueue,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.entity).toEqual({ type: "customer", id: "cust_1" });
  });

  it("points the entity at the right table, not at the alert's name", async () => {
    // Regression: `points-adjusted` doesn't start with "customer", so inferring
    // the entity from the alert name sent the job looking for an employee.
    const { calls, enqueue } = spyEnqueue();
    await recordAuditWithAlert(
      {
        organizationId: ORG,
        targetUserId: "someone_1",
        type: "impersonation_start",
        metadata: { isCustomer: true },
      },
      enqueue,
    );
    expect(calls[0]?.entity).toEqual({ type: "customer", id: "someone_1" });

    await recordAuditWithAlert(
      {
        organizationId: ORG,
        targetUserId: "emp_2",
        type: "impersonation_start",
        metadata: { isCustomer: false },
      },
      enqueue,
    );
    expect(calls[1]?.entity).toEqual({ type: "employee", id: "emp_2" });
  });

  it("treats a large deduction as loudly as a large gift", async () => {
    const { calls, enqueue } = spyEnqueue();
    await recordAuditWithAlert(
      {
        organizationId: ORG,
        type: "customer_stamps_adjust",
        metadata: { delta: -5 },
      },
      enqueue,
    );
    expect(calls).toHaveLength(1);
  });

  it("drops the store on an org-wide alert", async () => {
    const { calls, enqueue } = spyEnqueue();
    // A role change belongs to the whole org; carrying a store would hide it
    // from anyone whose switcher is pointed at a different branch.
    await recordAuditWithAlert(
      {
        organizationId: ORG,
        type: "role_change",
        storeId: "store_1",
        metadata: { from: "staff", to: "owner" },
      },
      enqueue,
    );
    expect(calls[0]?.storeId).toBeNull();
  });

  it("keeps the store on a store-scoped alert", async () => {
    const { calls, enqueue } = spyEnqueue();
    await recordAuditWithAlert(
      {
        organizationId: ORG,
        type: "customer_stamps_adjust",
        storeId: "store_1",
        metadata: { delta: 10 },
      },
      enqueue,
    );
    expect(calls[0]?.storeId).toBe("store_1");
  });

  it("skips the alert when there's no org to scope it to", async () => {
    const { calls, enqueue } = spyEnqueue();
    await recordAuditWithAlert({ type: "role_change" }, enqueue);
    expect(calls).toHaveLength(0);
  });
});

describe("emitAdminAlert", () => {
  it("never lets a broken queue bubble up", async () => {
    // The action already happened. Losing the notification is annoying;
    // rolling back the role change because of it would be a bug.
    await expect(
      emitAdminAlert(
        { organizationId: ORG, alertType: "customer-banned" },
        async () => {
          throw new Error("trigger.dev down");
        },
      ),
    ).resolves.toBeUndefined();
  });

  it("refuses to emit digest-only and cron types through the event path", async () => {
    const { calls, enqueue } = spyEnqueue();
    await emitAdminAlert(
      { organizationId: ORG, alertType: "customer-signup" },
      enqueue,
    );
    await emitAdminAlert(
      { organizationId: ORG, alertType: "daily-digest" },
      enqueue,
    );
    expect(calls).toHaveLength(0);
  });
});
