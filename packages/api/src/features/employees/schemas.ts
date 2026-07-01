import { z } from "zod";

import { listQueryBase } from "../_shared/list";

/**
 * Employee = a Better Auth `member` (role) + `user` (name/email/phone/banned) +
 * `store_staff` assignments, plus pending `invitation` rows (not-yet-accepted).
 * "cashier" in the UI maps to the canonical `staff` role.
 */

/** Roles assignable from the admin UI. `owner` is the seeded singleton — never
 *  assigned/changed here. */
export const assignableRoleSchema = z.enum(["staff", "manager"]);
export type AssignableRole = z.infer<typeof assignableRoleSchema>;

export const employeeStatusSchema = z.enum(["active", "invited", "disabled"]);
export type EmployeeStatus = z.infer<typeof employeeStatusSchema>;

/** Server-driven list query for the admin data-table (URL-driven via nuqs). */
export const employeesListInputSchema = listQueryBase.extend({
  role: z.array(z.enum(["staff", "manager", "owner"])).optional(),
  status: z.array(employeeStatusSchema).optional(),
  storeId: z.array(z.string()).optional(),
});
export type EmployeesListInput = z.infer<typeof employeesListInputSchema>;

export interface EmployeeStoreRef {
  id: string;
  name: string;
}

/** Lean row for the admin table. `kind` discriminates an accepted member from a
 *  pending invitation (which has no user/stats yet). `id` is the member id or
 *  the invitation id accordingly. */
export interface EmployeeListItem {
  kind: "member" | "invitation";
  id: string;
  userId: string | null;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  status: EmployeeStatus;
  stores: EmployeeStoreRef[];
  rating: number | null;
  createdAt: Date;
}

// ── Per-employee monthly stats ────────────────────────────────────────────────
export interface EmployeeStatLine {
  storeId: string;
  storeName: string;
  sales: number;
  salesAmountCents: number;
  stamps: number;
  redemptions: number;
  pointsAwarded: number;
}

export interface EmployeeStats {
  /** `YYYY-MM` of the current calendar month (org timezone). */
  month: string;
  perStore: EmployeeStatLine[];
  total: Omit<EmployeeStatLine, "storeId" | "storeName">;
}

// ── Team leaderboard (cross-employee performance) ─────────────────────────────
export const leaderboardPeriodSchema = z.enum(["month", "lastMonth", "range"]);
export type LeaderboardPeriod = z.infer<typeof leaderboardPeriodSchema>;

export const leaderboardInputSchema = z.object({
  period: leaderboardPeriodSchema.default("month"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  storeId: z.array(z.string()).optional(),
  /** Cap the returned rows (Analítica uses a small top-N; the full view omits it). */
  limit: z.number().int().min(1).max(500).optional(),
});
export type LeaderboardInput = z.infer<typeof leaderboardInputSchema>;

export interface LeaderboardRow {
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  sales: number;
  revenueCents: number;
  avgTicketCents: number;
  maxTicketCents: number;
  uniqueCustomers: number;
  stamps: number;
  redemptions: number;
  points: number;
}

export interface LeaderboardResult {
  /** `YYYY-MM-DD` window actually used (resolved from the period). */
  from: string;
  to: string;
  rows: LeaderboardRow[];
}

// ── Detail ────────────────────────────────────────────────────────────────────
export interface EmployeeSessionInfo {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  current: boolean;
}

export interface EmployeeDetail {
  memberId: string;
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  image: string | null;
  role: string;
  status: EmployeeStatus;
  rating: number | null;
  notes: string | null;
  stores: EmployeeStoreRef[];
  createdAt: Date;
  banReason: string | null;
}

// ── Activity feed (merged audit_log + loyalty events) ─────────────────────────
export const activityTypeSchema = z.enum([
  "login",
  "logout",
  "invite_sent",
  "invite_accepted",
  "role_change",
  "disable",
  "enable",
  "delete",
  "restore",
  "email_change",
  "rating_change",
  "stores_change",
  "impersonation_start",
  "impersonation_stop",
  "session_revoke",
  "sale",
  "stamp",
  "redemption",
]);
export type ActivityType = z.infer<typeof activityTypeSchema>;

export const employeeActivityInputSchema = listQueryBase.extend({
  memberId: z.string(),
  types: z.array(activityTypeSchema).optional(),
  storeId: z.array(z.string()).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type EmployeeActivityInput = z.infer<typeof employeeActivityInputSchema>;

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  createdAt: Date;
  /** Free-form detail payload (old/new email, role, store, customer, amounts…). */
  metadata: Record<string, unknown> | null;
}

// ── Mutations ─────────────────────────────────────────────────────────────────
export const memberIdSchema = z.object({ memberId: z.string() });
export type MemberIdInput = z.infer<typeof memberIdSchema>;

/** Selected roster ids for CSV export (member ids and/or invitation ids). */
export const bulkIdsSchema = z.object({ ids: z.array(z.string()).min(1).max(500) });
export type BulkIdsInput = z.infer<typeof bulkIdsSchema>;

export const bulkSetDisabledSchema = bulkIdsSchema.extend({ disabled: z.boolean() });
export type BulkSetDisabledInput = z.infer<typeof bulkSetDisabledSchema>;

export const inviteEmployeeSchema = z.object({
  email: z.string().email().max(200),
  role: assignableRoleSchema,
  storeIds: z.array(z.string()).default([]),
});
export type InviteEmployeeInput = z.infer<typeof inviteEmployeeSchema>;

export const updateEmployeeSchema = z.object({
  memberId: z.string(),
  name: z.string().max(120).optional(),
  phone: z.string().max(40).nullish(),
  role: assignableRoleSchema.optional(),
  storeIds: z.array(z.string()).optional(),
  notes: z.string().max(2000).nullish(),
  rating: z.number().int().min(1).max(5).nullish(),
});
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export const changeEmailSchema = z.object({
  memberId: z.string(),
  email: z.string().email().max(200),
});
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

export const setRatingSchema = z.object({
  memberId: z.string(),
  rating: z.number().int().min(1).max(5).nullable(),
});
export type SetRatingInput = z.infer<typeof setRatingSchema>;

export const disableEmployeeSchema = z.object({
  memberId: z.string(),
  reason: z.string().max(200).optional(),
});
export type DisableEmployeeInput = z.infer<typeof disableEmployeeSchema>;

export const revokeSessionSchema = z.object({
  memberId: z.string(),
  /** Omit to revoke all of the employee's sessions. */
  sessionToken: z.string().optional(),
});
export type RevokeSessionInput = z.infer<typeof revokeSessionSchema>;

/** The impersonation target is any user id (an employee OR a customer). */
export const impersonateSchema = z.object({ userId: z.string() });
export type ImpersonateInput = z.infer<typeof impersonateSchema>;

export interface ImpersonateResult {
  userId: string;
  /** true → redirect into the customer web app; false → stay in admin. */
  isCustomer: boolean;
}

/** A pending invitation accepted by the signed-in user (orchestrated by us, not
 *  the org plugin, so we can apply store assignments + write the audit). */
export const acceptInviteSchema = z.object({ invitationId: z.string() });
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
