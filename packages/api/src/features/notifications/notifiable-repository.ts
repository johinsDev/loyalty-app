import type { db as Db } from "@loyalty/db";
import { customer, member, user } from "@loyalty/db/schema";
import type {
  NotifiableRepository,
  ResolvedCustomerNotifiable,
  ResolvedUserNotifiable,
} from "@loyalty/notifications";
import { and, eq, isNull } from "drizzle-orm";

/**
 * Drizzle implementation of the engine's `NotifiableRepository`. Resolves the
 * contact info the channels need, for both recipient kinds: `resolve` for a
 * loyalty customer, `resolveUser` for a staff member receiving an admin alert.
 * Lives in `@loyalty/api` so both the API and the jobs Notifier bootstrap can
 * reuse it.
 */
export class DrizzleNotifiableRepository implements NotifiableRepository {
  constructor(private readonly db: typeof Db) {}

  async resolve(
    customerId: string,
    organizationId: string,
  ): Promise<ResolvedCustomerNotifiable | null> {
    const rows = await this.db
      .select({
        id: customer.id,
        organizationId: customer.organizationId,
        phone: customer.phone,
        email: customer.email,
        name: customer.name,
      })
      .from(customer)
      .where(
        and(
          eq(customer.id, customerId),
          eq(customer.organizationId, organizationId),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      kind: "customer",
      customerId: row.id,
      organizationId: row.organizationId,
      phone: row.phone,
      email: row.email,
      name: row.name,
    };
  }

  /**
   * A staff recipient. Joined through `member` so the org check is real (and a
   * soft-deleted employee resolves to null, which stops an alert from reaching
   * someone who was removed between fan-out and send). Unlike a customer, an
   * employee may legitimately have no phone.
   */
  async resolveUser(
    userId: string,
    organizationId: string,
  ): Promise<ResolvedUserNotifiable | null> {
    const rows = await this.db
      .select({
        id: user.id,
        phone: user.phoneNumber,
        email: user.email,
        name: user.name,
      })
      .from(user)
      .innerJoin(member, eq(member.userId, user.id))
      .where(
        and(
          eq(user.id, userId),
          eq(member.organizationId, organizationId),
          isNull(member.deletedAt),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      kind: "user",
      userId: row.id,
      organizationId,
      storeId: null,
      phone: row.phone,
      email: row.email,
      name: row.name,
    };
  }
}
