import type { Role } from "@loyalty/auth/server";
import type { db as Db } from "@loyalty/db";
import {
  adminNotification,
  auditLog,
  campaign,
  customer,
  member,
  organization,
  purchase,
  redemption,
  storeStaff,
  user,
} from "@loyalty/db/schema";
import type {
  AdminDatabaseNotificationInput,
  AdminDatabaseNotificationRepository,
} from "@loyalty/notifications";
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  or,
  type SQL,
} from "drizzle-orm";

import {
  buildOrderBy,
  pageCountOf,
  pageOffset,
  type ListResult,
} from "../_shared/list";
import type { AdminAlertListItem, AdminAlertsListInput } from "./schemas";

/** Columns the data-table may sort by. Anything else is ignored. */
const SORTABLE = {
  createdAt: adminNotification.createdAt,
  severity: adminNotification.severity,
  type: adminNotification.type,
};

/**
 * Reads and writes the operator inbox. Every read is scoped by
 * `(userId, organizationId)` — that pair IS the security boundary, since
 * fan-out already decided who may see what.
 */
export class AdminNotificationRepository
  implements AdminDatabaseNotificationRepository
{
  constructor(private readonly db: typeof Db) {}

  async create(
    input: AdminDatabaseNotificationInput,
  ): Promise<{ id: string }> {
    const rows = await this.db
      .insert(adminNotification)
      .values({
        userId: input.userId,
        organizationId: input.organizationId,
        storeId: input.storeId,
        type: input.type,
        severity: input.severity as never,
        title: input.title,
        body: input.body,
        data: input.data ?? null,
        entityType: (input.entityType ?? null) as never,
        entityId: input.entityId ?? null,
      })
      .returning({ id: adminNotification.id });
    return { id: rows[0]!.id };
  }

  /**
   * The store filter is intentionally inclusive: picking a branch in the
   * switcher must not hide org-wide alerts, or the owner would silently stop
   * seeing "role changed" the moment they scoped to a shop.
   */
  #scope(
    userId: string,
    organizationId: string,
    storeId?: string,
  ): SQL | undefined {
    return and(
      eq(adminNotification.userId, userId),
      eq(adminNotification.organizationId, organizationId),
      storeId
        ? or(
            eq(adminNotification.storeId, storeId),
            isNull(adminNotification.storeId),
          )
        : undefined,
    );
  }

  #filters(input: AdminAlertsListInput): SQL | undefined {
    const q = input.q?.trim();
    return and(
      q
        ? or(
            like(adminNotification.title, `%${q}%`),
            like(adminNotification.body, `%${q}%`),
          )
        : undefined,
      input.tab === "archive"
        ? isNotNull(adminNotification.archivedAt)
        : isNull(adminNotification.archivedAt),
      input.type?.length
        ? inArray(adminNotification.type, input.type)
        : undefined,
      input.severity?.length
        ? inArray(adminNotification.severity, input.severity as never[])
        : undefined,
      input.read === "unread" ? isNull(adminNotification.readAt) : undefined,
      input.read === "read" ? isNotNull(adminNotification.readAt) : undefined,
      input.createdFrom
        ? gte(adminNotification.createdAt, input.createdFrom)
        : undefined,
      input.createdTo
        ? lte(adminNotification.createdAt, input.createdTo)
        : undefined,
    );
  }

  async listForUser(
    userId: string,
    organizationId: string,
    input: AdminAlertsListInput,
  ): Promise<ListResult<AdminAlertListItem>> {
    const where = and(
      this.#scope(userId, organizationId, input.storeId),
      this.#filters(input),
    );
    const orderBy = buildOrderBy(input.sort, SORTABLE, [
      desc(adminNotification.createdAt),
    ]);

    const [rows, totals] = await Promise.all([
      this.db
        .select({
          id: adminNotification.id,
          type: adminNotification.type,
          severity: adminNotification.severity,
          title: adminNotification.title,
          body: adminNotification.body,
          data: adminNotification.data,
          storeId: adminNotification.storeId,
          entityType: adminNotification.entityType,
          entityId: adminNotification.entityId,
          readAt: adminNotification.readAt,
          archivedAt: adminNotification.archivedAt,
          createdAt: adminNotification.createdAt,
        })
        .from(adminNotification)
        .where(where)
        .orderBy(...orderBy)
        .limit(input.perPage)
        .offset(pageOffset(input.page, input.perPage)),
      this.db
        .select({ value: count() })
        .from(adminNotification)
        .where(where),
    ]);

    const total = totals[0]?.value ?? 0;
    return {
      rows: rows as AdminAlertListItem[],
      total,
      pageCount: pageCountOf(total, input.perPage),
    };
  }

  /** Unread AND not archived — archiving something unread clears the badge. */
  async unreadCount(
    userId: string,
    organizationId: string,
    storeId?: string,
  ): Promise<number> {
    const rows = await this.db
      .select({ value: count() })
      .from(adminNotification)
      .where(
        and(
          this.#scope(userId, organizationId, storeId),
          isNull(adminNotification.readAt),
          isNull(adminNotification.archivedAt),
        ),
      );
    return rows[0]?.value ?? 0;
  }

  async markRead(
    id: string,
    userId: string,
    organizationId: string,
  ): Promise<number> {
    const res = await this.db
      .update(adminNotification)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(adminNotification.id, id),
          eq(adminNotification.userId, userId),
          eq(adminNotification.organizationId, organizationId),
          isNull(adminNotification.readAt),
        ),
      );
    return res.rowsAffected;
  }

  async markAllRead(userId: string, organizationId: string): Promise<number> {
    const res = await this.db
      .update(adminNotification)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(adminNotification.userId, userId),
          eq(adminNotification.organizationId, organizationId),
          isNull(adminNotification.readAt),
          isNull(adminNotification.archivedAt),
        ),
      );
    return res.rowsAffected;
  }

  /** Archiving also marks read: it left the inbox, it can't stay "new". */
  async archive(
    ids: string[],
    userId: string,
    organizationId: string,
  ): Promise<number> {
    const now = new Date();
    const res = await this.db
      .update(adminNotification)
      .set({ archivedAt: now, readAt: now })
      .where(
        and(
          inArray(adminNotification.id, ids),
          eq(adminNotification.userId, userId),
          eq(adminNotification.organizationId, organizationId),
          isNull(adminNotification.archivedAt),
        ),
      );
    return res.rowsAffected;
  }

  async archiveAll(userId: string, organizationId: string): Promise<number> {
    const now = new Date();
    const res = await this.db
      .update(adminNotification)
      .set({ archivedAt: now, readAt: now })
      .where(
        and(
          eq(adminNotification.userId, userId),
          eq(adminNotification.organizationId, organizationId),
          isNull(adminNotification.archivedAt),
        ),
      );
    return res.rowsAffected;
  }

  async unarchive(
    ids: string[],
    userId: string,
    organizationId: string,
  ): Promise<number> {
    const res = await this.db
      .update(adminNotification)
      .set({ archivedAt: null })
      .where(
        and(
          inArray(adminNotification.id, ids),
          eq(adminNotification.userId, userId),
          eq(adminNotification.organizationId, organizationId),
          isNotNull(adminNotification.archivedAt),
        ),
      );
    return res.rowsAffected;
  }

  /**
   * Who hears about this alert.
   *
   * Role floor decides the audience; a store-scoped alert additionally requires
   * a cashier to actually work at that branch (managers and owners oversee
   * every branch, so they're never filtered by store).
   *
   * `user.banned` is NULLABLE — a plain `eq(banned, false)` would drop everyone
   * who has never been banned, i.e. almost the entire staff.
   */
  async resolveAudience(
    organizationId: string,
    roles: Role[],
    storeId: string | null,
  ): Promise<string[]> {
    if (roles.length === 0) return [];
    const rows = await this.db
      .selectDistinct({ userId: member.userId })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .leftJoin(
        storeStaff,
        storeId
          ? and(
              eq(storeStaff.userId, member.userId),
              eq(storeStaff.storeId, storeId),
            )
          : // Never matches; the branch below ignores the join anyway.
            eq(storeStaff.userId, member.userId),
      )
      .where(
        and(
          eq(member.organizationId, organizationId),
          isNull(member.deletedAt),
          inArray(member.role, roles),
          or(isNull(user.banned), eq(user.banned, false)),
          storeId
            ? or(ne(member.role, "staff"), isNotNull(storeStaff.id))
            : undefined,
        ),
      );
    return rows.map((r) => r.userId);
  }

  /**
   * Display names for the copy ("Ana le ajustó 500 puntos a Lucía"), resolved
   * in one place so the job never touches Drizzle. A missing name degrades the
   * wording; it never fails the alert.
   */
  async resolveDisplayNames(
    entity: { type: string; id: string } | undefined,
    actorUserId: string | null | undefined,
  ): Promise<{ entityName: string | null; actorName: string | null }> {
    const [entityName, actorName] = await Promise.all([
      entity ? this.#entityName(entity) : Promise.resolve(null),
      actorUserId ? this.#userName(actorUserId) : Promise.resolve(null),
    ]);
    return { entityName, actorName };
  }

  async #entityName(entity: { type: string; id: string }): Promise<string | null> {
    try {
      if (entity.type === "employee") return await this.#userName(entity.id);
      if (entity.type === "customer") {
        const rows = await this.db
          .select({ name: customer.name })
          .from(customer)
          .where(eq(customer.id, entity.id))
          .limit(1);
        return rows[0]?.name ?? null;
      }
      if (entity.type === "campaign") {
        const rows = await this.db
          .select({ name: campaign.name })
          .from(campaign)
          .where(eq(campaign.id, entity.id))
          .limit(1);
        return rows[0]?.name ?? null;
      }
    } catch {
      // Fall through to the generic wording.
    }
    return null;
  }

  async #userName(userId: string): Promise<string | null> {
    try {
      const rows = await this.db
        .select({ name: user.name, email: user.email })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      return rows[0]?.name ?? rows[0]?.email ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Counts for the daily digest, over `[from, to)`.
   *
   * This is where the events that deliberately never raised their own row end
   * up: new signups, and adjustments that fell under the alert threshold. If
   * they weren't summarised here they'd be invisible, which would make the
   * "keep the inbox quiet" rule a way of losing information rather than
   * ordering it.
   */
  async digestCounts(
    organizationId: string,
    from: Date,
    to: Date,
  ): Promise<{
    signups: number;
    purchases: number;
    redemptions: number;
    adjustments: number;
  }> {
    const [signups, purchases, redemptions, adjustments] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(customer)
        .where(
          and(
            eq(customer.organizationId, organizationId),
            gte(customer.createdAt, from),
            lt(customer.createdAt, to),
          ),
        ),
      this.db
        .select({ value: count() })
        .from(purchase)
        .where(
          and(
            eq(purchase.organizationId, organizationId),
            gte(purchase.createdAt, from),
            lt(purchase.createdAt, to),
            isNull(purchase.voidedAt),
          ),
        ),
      this.db
        .select({ value: count() })
        .from(redemption)
        .where(
          and(
            eq(redemption.organizationId, organizationId),
            gte(redemption.createdAt, from),
            lt(redemption.createdAt, to),
          ),
        ),
      this.db
        .select({ value: count() })
        .from(auditLog)
        .where(
          and(
            eq(auditLog.organizationId, organizationId),
            gte(auditLog.createdAt, from),
            lt(auditLog.createdAt, to),
            inArray(auditLog.type, [
              "customer_points_adjust",
              "customer_stamps_adjust",
            ]),
          ),
        ),
    ]);
    return {
      signups: signups[0]?.value ?? 0,
      purchases: purchases[0]?.value ?? 0,
      redemptions: redemptions[0]?.value ?? 0,
      adjustments: adjustments[0]?.value ?? 0,
    };
  }

  /** Every org that could receive a digest. */
  async listOrganizationIds(): Promise<string[]> {
    const rows = await this.db
      .select({ id: organization.id })
      .from(organization);
    return rows.map((r) => r.id);
  }

  /** Retention: archived rows past the window are dropped. */
  async pruneArchived(olderThan: Date): Promise<number> {
    const res = await this.db
      .delete(adminNotification)
      .where(
        and(
          isNotNull(adminNotification.archivedAt),
          lt(adminNotification.archivedAt, olderThan),
        ),
      );
    return res.rowsAffected;
  }
}
