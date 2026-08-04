import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  CalendarDays,
  CheckCircle2,
  Coins,
  Gift,
  Megaphone,
  Receipt,
  ShieldAlert,
  Stamp,
  UserPlus,
  UserX,
  type LucideIcon,
} from "lucide-react";

/**
 * Presentation for an alert row. Deliberately a LOCAL table of plain strings:
 * importing the catalog's values from `@loyalty/api` would drag better-auth,
 * drizzle and the DB client into the browser bundle. Types may be imported
 * from the schemas subpath; values may not.
 */
const ICONS: Record<string, LucideIcon> = {
  "staff-role-changed": BadgeCheck,
  "staff-disabled": UserX,
  "impersonation-started": ShieldAlert,
  "invite-accepted": UserPlus,
  "customer-banned": Ban,
  "points-adjusted": Coins,
  "stamps-adjusted": Stamp,
  "purchase-voided": Receipt,
  "campaign-finished": Megaphone,
  "campaign-failures": AlertTriangle,
  "customer-signup": UserPlus,
  "daily-digest": CalendarDays,
};

export function alertIcon(type: string): LucideIcon {
  return ICONS[type] ?? Gift;
}

/** Tone classes per severity, matching the admin palette. */
export const SEVERITY_TONE: Record<string, string> = {
  info: "bg-primary/10 text-primary",
  success: "bg-emerald-500/15 text-emerald-600",
  warning: "bg-amber-500/15 text-amber-600",
  critical: "bg-red-500/15 text-red-600",
};

export function severityTone(severity: string): string {
  return SEVERITY_TONE[severity] ?? SEVERITY_TONE.info!;
}

export { CheckCircle2 };

/** Object href for the localized `Link`. */
export type EntityHref = { pathname: string; params: { id: string } };

/**
 * Where a row's "go to the thing" link points. Returns the **object** form the
 * localized `Link` needs — a plain interpolated string throws
 * "Dynamic href found in <Link> while using the /app router". The `[storeId]`
 * segment is injected by `@/i18n/nav`.
 *
 * Null when the alert has no entity to visit, or when the entity has no detail
 * screen of its own (campaigns and employees are edited in place).
 */
export function entityHref(
  entityType: string | null,
  entityId: string | null,
): EntityHref | null {
  if (!entityType || !entityId) return null;
  switch (entityType) {
    case "customer":
      return { pathname: "/customers/[id]", params: { id: entityId } };
    case "purchase":
      return { pathname: "/purchases/[id]", params: { id: entityId } };
    default:
      return null;
  }
}
