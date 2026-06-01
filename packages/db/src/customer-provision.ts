import { db } from "./client";
import * as schema from "./schema";

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
