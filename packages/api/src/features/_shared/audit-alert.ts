import { recordAudit, type RecordAuditInput } from "@loyalty/db";
import type { AuditType } from "@loyalty/db/schema";
import { tasks } from "@trigger.dev/sdk/v3";

import {
  ADMIN_ALERTS,
  producesImmediateRow,
  type AdminAlertType,
} from "../admin-notifications/catalog";

/**
 * Payload the `send-admin-alert` job consumes. Kept structural (not imported
 * from `@loyalty/jobs`) because `jobs` already depends on `api` — importing
 * back would close a cycle.
 */
export interface AdminAlertPayload {
  organizationId: string;
  alertType: AdminAlertType;
  /** Branch the alert belongs to; null/absent = org-wide. */
  storeId?: string | null;
  /** Excluded from the audience — you don't alert yourself about your own action. */
  actorUserId?: string | null;
  entity?: { type: string; id: string };
  payload?: Record<string, unknown>;
}

export type EnqueueAdminAlert = (payload: AdminAlertPayload) => Promise<void>;

// Untyped trigger by id, same reason as the customer notification seam in
// `stamps/service.ts`: typing it would create an api → jobs cycle.
const defaultEnqueue: EnqueueAdminAlert = async (payload) => {
  await tasks.trigger("send-admin-alert", payload);
};

/**
 * Emit an operator alert. Best-effort by design: a failed alert must never
 * roll back the action that caused it — losing a notification is annoying,
 * losing a role change is a bug.
 */
export async function emitAdminAlert(
  payload: AdminAlertPayload,
  enqueue: EnqueueAdminAlert = defaultEnqueue,
): Promise<void> {
  try {
    const def = ADMIN_ALERTS[payload.alertType];
    // `digest` and `cron` types never travel the event path — the nightly job
    // derives them instead.
    if (def.delivery === "digest" || def.delivery === "cron") return;
    await enqueue({
      ...payload,
      storeId: def.storeScoped ? (payload.storeId ?? null) : null,
    });
  } catch (error) {
    console.error("[admin-alert] failed to enqueue", {
      type: payload.alertType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Audit types that also deserve the owner's attention. The rest of the ~20
 * audit types stay silent: they belong to the activity log, not the inbox.
 */
const AUDIT_TO_ALERT: Partial<Record<AuditType, AdminAlertType>> = {
  role_change: "staff-role-changed",
  disable: "staff-disabled",
  impersonation_start: "impersonation-started",
  invite_accepted: "invite-accepted",
  customer_ban: "customer-banned",
  customer_points_adjust: "points-adjusted",
  customer_stamps_adjust: "stamps-adjusted",
};

/**
 * What `targetUserId` points at, per audit type. Stated explicitly rather than
 * inferred from the alert name — `points-adjusted` is about a customer even
 * though nothing in its name says so, and guessing sends the job looking in
 * the wrong table for the display name.
 */
const AUDIT_TO_ENTITY: Partial<Record<AuditType, "customer" | "employee">> = {
  role_change: "employee",
  disable: "employee",
  invite_accepted: "employee",
  customer_ban: "customer",
  customer_points_adjust: "customer",
  customer_stamps_adjust: "customer",
};

/** Reads the size of the change out of the audit metadata, per alert type. */
function magnitudeOf(
  alertType: AdminAlertType,
  metadata: Record<string, unknown> | null | undefined,
): number | null {
  if (!metadata) return null;
  const raw =
    alertType === "points-adjusted" ? metadata.points : metadata.delta;
  return typeof raw === "number" ? raw : null;
}

/**
 * Impersonation is the one type that can target either: the owner can step
 * into a customer's shoes or an employee's, and the service records which.
 */
function entityTypeOf(entry: RecordAuditInput): "customer" | "employee" {
  if (entry.type === "impersonation_start") {
    return entry.metadata?.isCustomer === true ? "customer" : "employee";
  }
  return AUDIT_TO_ENTITY[entry.type] ?? "employee";
}

export interface RecordAuditWithAlertInput extends RecordAuditInput {
  /** Branch the action happened at, for store-scoped alerts. */
  storeId?: string | null;
}

/**
 * `recordAudit`, plus an operator alert when the audit type warrants one.
 *
 * This wrapper lives in `@loyalty/api` rather than next to `recordAudit` in
 * `@loyalty/db` on purpose: `@loyalty/db` is imported by the Worker and by
 * `@loyalty/auth`, and must not grow a `@trigger.dev/sdk` dependency.
 *
 * The audit row is written first and unconditionally — the trail is the
 * system of record; the alert is a courtesy on top of it.
 */
export async function recordAuditWithAlert(
  entry: RecordAuditWithAlertInput,
  enqueue: EnqueueAdminAlert = defaultEnqueue,
): Promise<void> {
  const { storeId, ...audit } = entry;
  await recordAudit(audit);

  const alertType = AUDIT_TO_ALERT[entry.type];
  if (!alertType || !entry.organizationId) return;
  if (!producesImmediateRow(alertType, magnitudeOf(alertType, entry.metadata)))
    return;

  await emitAdminAlert(
    {
      organizationId: entry.organizationId,
      alertType,
      storeId,
      actorUserId: entry.actorUserId,
      entity: entry.targetUserId
        ? { type: entityTypeOf(entry), id: entry.targetUserId }
        : undefined,
      payload: { ...entry.metadata, actorUserId: entry.actorUserId },
    },
    enqueue,
  );
}
