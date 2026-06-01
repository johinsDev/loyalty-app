import type { db as Db } from "@loyalty/db";
import { customer } from "@loyalty/db/schema";
import type {
  NotifiableRepository,
  ResolvedNotifiable,
} from "@loyalty/notifications";
import { and, eq } from "drizzle-orm";

/**
 * Drizzle implementation of the engine's `NotifiableRepository`. Resolves a
 * customer's contact info for the channels. Lives in `@loyalty/api` so both
 * the API and the jobs Notifier bootstrap can reuse it.
 */
export class DrizzleNotifiableRepository implements NotifiableRepository {
  constructor(private readonly db: typeof Db) {}

  async resolve(
    customerId: string,
    organizationId: string,
  ): Promise<ResolvedNotifiable | null> {
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
      customerId: row.id,
      organizationId: row.organizationId,
      phone: row.phone,
      email: row.email,
      name: row.name,
    };
  }
}
