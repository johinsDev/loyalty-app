/**
 * Canonical role model for the loyalty-app monorepo.
 *
 * Every authorization decision (tRPC procedures, layouts, /api handlers,
 * UI conditional rendering) reads from this single source of truth.
 *
 * Storage: `member.role` in @loyalty/db. The column is `text` so the
 * runtime check uses string comparison — invalid values degrade to
 * `customer` (see `getUserRole` in ./server).
 *
 * The four personas:
 *
 * | Role | Member row? | Where they sign in | What they can do |
 * |------|-------------|---------------------|------------------|
 * | customer | no | apps/web (phone or Google) | Use the loyalty PWA: see card, redeem rewards, manage profile |
 * | staff    | yes | apps/admin (Google) | Cashier ops: add stamps, look up customers |
 * | manager  | yes | apps/admin (Google) | Staff + invite/manage staff, configure rewards, read reports |
 * | owner    | yes | apps/admin (Google) | Manager + access dev tooling (outboxes, smoke pages) |
 */
export const ROLES = {
  customer: "customer",
  staff: "staff",
  manager: "manager",
  owner: "owner",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const STAFF_OR_ABOVE: readonly Role[] = [
  ROLES.staff,
  ROLES.manager,
  ROLES.owner,
];

export const MANAGER_OR_ABOVE: readonly Role[] = [ROLES.manager, ROLES.owner];

export const OWNER_ONLY: readonly Role[] = [ROLES.owner];

const KNOWN_ROLES: readonly string[] = Object.values(ROLES);

/**
 * Narrows a free-text DB value to a known Role. Falls back to
 * `customer` for unknown values so misconfigured rows fail safe
 * (least privilege).
 */
export function coerceRole(value: string | null | undefined): Role {
  if (value && KNOWN_ROLES.includes(value)) return value as Role;
  return ROLES.customer;
}

export function isStaffRole(role: Role): boolean {
  return STAFF_OR_ABOVE.includes(role);
}
