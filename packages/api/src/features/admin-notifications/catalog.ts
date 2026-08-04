import { ROLES, type Role } from "@loyalty/auth/server";
import type { AdminAlertSeverity } from "@loyalty/db/schema";

/**
 * The alert catalog: what the shop's operators get told about, who hears it,
 * and how loud.
 *
 * This is deliberately a plain object literal — `packages/api` is bundled into
 * the Worker, and workerd forbids code generation, so no factories or computed
 * lookups here.
 *
 * Two concepts stay separate on purpose. **Alerts** (this file) are things that
 * want attention: dozens a week, with a badge and a read state. The firehose of
 * everything that happens in the shop belongs to the activity log, which has no
 * badge and no read state. Putting a sale in here would drown the inbox in a
 * week — a single shop does ~150 a day.
 */
export const ADMIN_ALERT_TYPES = [
  "staff-role-changed",
  "staff-disabled",
  "impersonation-started",
  "invite-accepted",
  "customer-banned",
  "points-adjusted",
  "stamps-adjusted",
  "purchase-voided",
  "campaign-finished",
  "campaign-failures",
  "customer-signup",
  "daily-digest",
] as const;

export type AdminAlertType = (typeof ADMIN_ALERT_TYPES)[number];

/**
 * How an alert reaches the inbox.
 *
 * - `immediate` — a row, now.
 * - `threshold` — a row only when the change is big enough to care about;
 *   smaller ones are counted into the daily digest instead. Without this the
 *   cashier's routine stamp fixes would bury the one adjustment that mattered.
 * - `digest` — never its own row; only ever a line in the daily summary.
 * - `cron` — produced by a scheduled job rather than an event.
 */
export type AdminAlertDelivery = "immediate" | "threshold" | "digest" | "cron";

export interface AdminAlertDefinition {
  /** Lowest operator role that receives it. */
  minRole: Role;
  /**
   * When true the alert belongs to one branch: staff only get it if they're
   * assigned to that store. Managers and owners always see every store.
   */
  storeScoped: boolean;
  delivery: AdminAlertDelivery;
  /** Only for `threshold` delivery: the absolute change that earns a row. */
  threshold?: number;
  severity: AdminAlertSeverity;
  /**
   * Channels this alert can actually travel on — the single source of truth
   * shared by the notification's `via()` and the config screen. Staff have no
   * push tokens and usually no phone, so the inbox is the floor and mail is
   * the only escalation.
   */
  channels: AdminAlertChannel[];
}

/** Channels an operator alert can use. */
export type AdminAlertChannel = "database" | "mail";

export const ADMIN_ALERTS: Record<AdminAlertType, AdminAlertDefinition> = {
  "staff-role-changed": {
    minRole: ROLES.owner,
    storeScoped: false,
    delivery: "immediate",
    severity: "warning",
    channels: ["database"],
  },
  "staff-disabled": {
    minRole: ROLES.owner,
    storeScoped: false,
    delivery: "immediate",
    severity: "warning",
    channels: ["database"],
  },
  "impersonation-started": {
    minRole: ROLES.owner,
    storeScoped: false,
    delivery: "immediate",
    severity: "critical",
    channels: ["database", "mail"],
  },
  "invite-accepted": {
    minRole: ROLES.owner,
    storeScoped: false,
    delivery: "immediate",
    severity: "success",
    channels: ["database"],
  },
  "customer-banned": {
    minRole: ROLES.manager,
    storeScoped: false,
    delivery: "immediate",
    severity: "warning",
    channels: ["database"],
  },
  "points-adjusted": {
    minRole: ROLES.manager,
    storeScoped: true,
    delivery: "threshold",
    threshold: 100,
    severity: "warning",
    channels: ["database"],
  },
  "stamps-adjusted": {
    minRole: ROLES.manager,
    storeScoped: true,
    delivery: "threshold",
    threshold: 3,
    severity: "warning",
    channels: ["database"],
  },
  "purchase-voided": {
    minRole: ROLES.manager,
    storeScoped: true,
    delivery: "immediate",
    severity: "warning",
    channels: ["database"],
  },
  "campaign-finished": {
    minRole: ROLES.manager,
    storeScoped: false,
    delivery: "immediate",
    severity: "success",
    channels: ["database"],
  },
  "campaign-failures": {
    minRole: ROLES.manager,
    storeScoped: false,
    delivery: "immediate",
    severity: "warning",
    channels: ["database"],
  },
  "customer-signup": {
    minRole: ROLES.manager,
    storeScoped: true,
    delivery: "digest",
    severity: "info",
    channels: ["database"],
  },
  "daily-digest": {
    minRole: ROLES.manager,
    storeScoped: false,
    delivery: "cron",
    severity: "info",
    channels: ["database"],
  },
};

const KNOWN_TYPES: readonly string[] = ADMIN_ALERT_TYPES;

export function isAdminAlertType(value: string): value is AdminAlertType {
  return KNOWN_TYPES.includes(value);
}

/**
 * Whether this occurrence earns its own inbox row right now. `threshold` types
 * pass only when the magnitude clears the bar; `digest` and `cron` types never
 * come through the event path.
 */
export function producesImmediateRow(
  type: AdminAlertType,
  magnitude?: number | null,
): boolean {
  const def = ADMIN_ALERTS[type];
  if (def.delivery === "immediate") return true;
  if (def.delivery !== "threshold") return false;
  if (magnitude == null) return false;
  return Math.abs(magnitude) >= (def.threshold ?? 0);
}
