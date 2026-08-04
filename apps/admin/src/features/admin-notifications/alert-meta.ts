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

/**
 * Where a row's "go to the thing" link points. Returns a store-scoped path
 * (the admin `Link` injects the `[storeId]` segment itself), or null when the
 * alert has no entity to visit.
 */
export function entityHref(
  entityType: string | null,
  entityId: string | null,
): string | null {
  if (!entityType || !entityId) return null;
  switch (entityType) {
    case "customer":
      return `/customers/${entityId}`;
    case "purchase":
      return `/purchases/${entityId}`;
    case "campaign":
      return `/campaigns/${entityId}`;
    case "employee":
      return `/employees/${entityId}`;
    default:
      return null;
  }
}
