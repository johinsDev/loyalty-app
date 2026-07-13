import { and, eq, ne } from "drizzle-orm";

import { db } from "./client";
import * as schema from "./schema";

/**
 * Whether a phone number is already linked to a user account (the unique
 * `user.phoneNumber`). Used to warn a Google user UPFRONT in /complete-phone
 * before sending an OTP they could never verify (the phone is taken). Pass the
 * current user's id to exclude their own number.
 */
export async function phoneNumberInUse(
  phone: string,
  excludeUserId?: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(
      and(
        eq(schema.user.phoneNumber, phone),
        excludeUserId ? ne(schema.user.id, excludeUserId) : undefined,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export interface ProvisionCustomerInput {
  /** Customer id — set to the Better Auth `user.id` so the web profile
   *  (which addresses the logged-in person by `session.user.id`) and push
   *  tokens line up. */
  userId: string;
  organizationId: string;
  /** Required — the loyalty program is phone-first. */
  phone: string;
  email?: string | null;
  name?: string | null;
}

/**
 * Create the `customer` row that mirrors a web `user`. Idempotent —
 * `onConflictDoNothing` covers both the `id` PK and the `(org, phone)` unique
 * index, so re-running (signup hook + backfill) never throws or duplicates.
 *
 * Returns `true` when a row was actually inserted. Used by the Better Auth
 * sign-up hook (`packages/auth/src/server.ts`) and the `db:backfill-customers`
 * CLI. Callers skip users without a phone — those don't become customers.
 */
export async function provisionCustomerForUser(
  input: ProvisionCustomerInput,
): Promise<boolean> {
  const result = await db
    .insert(schema.customer)
    .values({
      id: input.userId,
      organizationId: input.organizationId,
      phone: input.phone,
      email: input.email ?? null,
      name: input.name ?? null,
    })
    .onConflictDoNothing();
  return result.rowsAffected > 0;
}

/**
 * Whether a `customer` row exists for this user (the `customer.id` mirrors the
 * Better Auth `user.id`). This is the authoritative "is a loyalty customer"
 * signal — set when the user verifies a phone — used by the web app's
 * `requireCustomer` gate. A phone-less account (e.g. a Google sign-in that
 * hasn't completed the phone step, or staff) returns `false`.
 */
export async function customerExistsForUser(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.customer.id })
    .from(schema.customer)
    .where(eq(schema.customer.id, userId))
    .limit(1);
  return rows.length > 0;
}

/** Every customer id of an org — for org-wide fan-outs (announcements). */
export async function listCustomerIds(organizationId: string): Promise<string[]> {
  const rows = await db
    .select({ id: schema.customer.id })
    .from(schema.customer)
    .where(eq(schema.customer.organizationId, organizationId));
  return rows.map((r) => r.id);
}
