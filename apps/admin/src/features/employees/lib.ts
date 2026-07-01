import type {
  EmployeeListItem,
  EmployeeStatus,
} from "@loyalty/api/features/employees/schemas";

/** Roles assignable from the admin UI (owner is the seeded singleton). */
export const ASSIGNABLE_ROLES = ["staff", "manager"] as const;

/** Every role that can appear in a row (owner shows but isn't assignable). */
export const ROW_ROLES = ["owner", "manager", "staff"] as const;

export const STATUSES: EmployeeStatus[] = ["active", "invited", "disabled"];

/** 2-letter avatar initials from a name or email. */
export function initialsFor(row: {
  name: string | null;
  email: string | null;
}): string {
  const src = row.name?.trim() || row.email?.split("@")[0] || "";
  const parts = src.split(/[\s.]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return (src.slice(0, 2) || "??").toUpperCase();
}

export function displayName(row: EmployeeListItem): string {
  return row.name?.trim() || row.email?.split("@")[0] || "—";
}

