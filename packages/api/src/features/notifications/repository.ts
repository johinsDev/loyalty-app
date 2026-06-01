import type { db as Db } from "@loyalty/db";
import {
  customer,
  notification,
  type NotificationRow,
} from "@loyalty/db/schema";
import type {
  DatabaseNotificationInput,
  DatabaseNotificationRepository,
} from "@loyalty/notifications";
import { and, desc, eq, isNull, like, sql } from "drizzle-orm";

import type { FeedFilter, ListCustomersInput } from "./schemas";

export interface FeedResult {
  rows: NotificationRow[];
  total: number;
}

export interface CustomerSummary {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
}

/**
 * Drizzle access for the in-app `notification` feed. Implements the
 * `DatabaseNotificationRepository` the `database` channel writes through, and
 * serves the customer's read/mark-read surface + the admin customer picker.
 * The only layer in this feature that touches the db.
 */
export class NotificationRepository implements DatabaseNotificationRepository {
  constructor(private readonly db: typeof Db) {}

  async create(input: DatabaseNotificationInput): Promise<{ id: string }> {
    const rows = (await this.db
      .insert(notification)
      .values({
        customerId: input.customerId,
        organizationId: input.organizationId,
        type: input.type,
        category: input.category,
        title: input.title,
        body: input.body,
        data: input.data ?? null,
      })
      .returning({ id: notification.id })) as { id: string }[];
    const id = rows[0]?.id;
    if (!id) throw new Error("Failed to insert notification");
    return { id };
  }

  async listForCustomer(
    customerId: string,
    organizationId: string,
    filter: FeedFilter,
    page: number,
    pageSize: number,
  ): Promise<FeedResult> {
    const offset = (page - 1) * pageSize;
    const where =
      filter === "unread"
        ? and(
            eq(notification.customerId, customerId),
            eq(notification.organizationId, organizationId),
            isNull(notification.readAt),
          )
        : and(
            eq(notification.customerId, customerId),
            eq(notification.organizationId, organizationId),
          );

    const rows = (await this.db
      .select()
      .from(notification)
      .where(where)
      .orderBy(desc(notification.createdAt))
      .limit(pageSize)
      .offset(offset)) as NotificationRow[];

    const countRows = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(notification)
      .where(where);
    return { rows, total: countRows[0]?.value ?? 0 };
  }

  async unreadCount(
    customerId: string,
    organizationId: string,
  ): Promise<number> {
    const rows = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(notification)
      .where(
        and(
          eq(notification.customerId, customerId),
          eq(notification.organizationId, organizationId),
          isNull(notification.readAt),
        ),
      );
    return rows[0]?.value ?? 0;
  }

  /** Mark one notification read (scoped to its owner). Returns rows affected. */
  async markRead(id: string, customerId: string): Promise<number> {
    const result = await this.db
      .update(notification)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notification.id, id),
          eq(notification.customerId, customerId),
          isNull(notification.readAt),
        ),
      );
    return result.rowsAffected;
  }

  async markAllRead(
    customerId: string,
    organizationId: string,
  ): Promise<number> {
    const result = await this.db
      .update(notification)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notification.customerId, customerId),
          eq(notification.organizationId, organizationId),
          isNull(notification.readAt),
        ),
      );
    return result.rowsAffected;
  }

  /** Delete one notification (scoped to its owner). Returns rows affected. */
  async delete(id: string, customerId: string): Promise<number> {
    const result = await this.db
      .delete(notification)
      .where(
        and(eq(notification.id, id), eq(notification.customerId, customerId)),
      );
    return result.rowsAffected;
  }

  async deleteAll(
    customerId: string,
    organizationId: string,
  ): Promise<number> {
    const result = await this.db
      .delete(notification)
      .where(
        and(
          eq(notification.customerId, customerId),
          eq(notification.organizationId, organizationId),
        ),
      );
    return result.rowsAffected;
  }

  /** Customers in the org, for the admin send picker. */
  async listCustomers(
    organizationId: string,
    input: ListCustomersInput,
  ): Promise<CustomerSummary[]> {
    const where = input.search
      ? and(
          eq(customer.organizationId, organizationId),
          like(customer.name, `%${input.search}%`),
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
      .limit(input.limit);
  }
}
