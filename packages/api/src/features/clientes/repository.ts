import type { db as Db } from "@loyalty/db";
import { customer } from "@loyalty/db/schema";
import { and, desc, eq, like, or } from "drizzle-orm";

export interface CustomerSearchItem {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
}

/** Drizzle access for customer lookups (the cashier picker). Only layer that
 *  touches the db; org-scoped. */
export class ClientesRepository {
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
          ),
        )
      : eq(customer.organizationId, organizationId);

    return this.db
      .select({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
      })
      .from(customer)
      .where(where)
      .orderBy(desc(customer.createdAt))
      .limit(limit);
  }
}
