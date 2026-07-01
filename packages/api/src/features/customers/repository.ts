import type { db as Db } from "@loyalty/db";
import { customer, pointsAccount } from "@loyalty/db/schema";
import { and, desc, eq, like, or } from "drizzle-orm";

export interface CustomerSearchItem {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  nickname: string | null;
  tierKey: string | null;
}

/** Drizzle access for customer lookups (the cashier picker + banner audience).
 *  Only layer that touches the db; org-scoped. */
export class CustomersRepository {
  constructor(private readonly db: typeof Db) {}

  async search(
    organizationId: string,
    query: string,
    limit: number,
  ): Promise<CustomerSearchItem[]> {
    const q = query.trim();
    const where = q
      ? and(
          eq(customer.organizationId, organizationId),
          or(
            like(customer.name, `%${q}%`),
            like(customer.phone, `%${q}%`),
            like(customer.email, `%${q}%`),
            like(customer.nickname, `%${q}%`),
          ),
        )
      : eq(customer.organizationId, organizationId);

    return this.db
      .select({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        nickname: customer.nickname,
        tierKey: pointsAccount.currentTierKey,
      })
      .from(customer)
      .leftJoin(pointsAccount, eq(pointsAccount.customerId, customer.id))
      .where(where)
      .orderBy(desc(customer.createdAt))
      .limit(limit);
  }
}
