import type { db as Db } from "@loyalty/db";
import {
  auditLog,
  customer,
  invitation,
  member,
  pointsTransaction,
  purchase,
  redemption,
  reward,
  stamp,
  store,
  storeStaff,
  user,
  type AuditType,
  type InvitationRow,
  type MemberRow,
  type UserRow,
} from "@loyalty/db/schema";
import { and, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";

import type {
  ActivityEntry,
  EmployeeDetail,
  EmployeeListItem,
  EmployeeStoreRef,
} from "./schemas";

/** Per-store aggregate keyed by storeId. */
type StoreAgg = {
  sales: number;
  salesAmountCents: number;
  stamps: number;
  redemptions: number;
  pointsAwarded: number;
};

const emptyAgg = (): StoreAgg => ({
  sales: 0,
  salesAmountCents: 0,
  stamps: 0,
  redemptions: 0,
  pointsAwarded: 0,
});

/** Drizzle access for the employees feature (members + invitations + store
 *  assignments + per-employee stats + activity). Org-scoped throughout. */
export class EmployeesRepository {
  constructor(private readonly db: typeof Db) {}

  // ── Roster sources ──────────────────────────────────────────────────────────
  /** All non-deleted members joined to their user row. */
  async listMembers(
    orgId: string,
  ): Promise<{ member: MemberRow; user: UserRow }[]> {
    const rows = await this.db
      .select({ member, user })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(and(eq(member.organizationId, orgId), isNull(member.deletedAt)));
    return rows;
  }

  /** Pending (unaccepted, unexpired) invitations. */
  async listPendingInvitations(orgId: string): Promise<InvitationRow[]> {
    return this.db
      .select()
      .from(invitation)
      .where(
        and(
          eq(invitation.organizationId, orgId),
          eq(invitation.status, "pending"),
        ),
      );
  }

  /** Map of userId → assigned stores (id+name). */
  async assignmentsByUser(
    orgId: string,
  ): Promise<Map<string, EmployeeStoreRef[]>> {
    const rows = await this.db
      .select({ userId: storeStaff.userId, id: store.id, name: store.name })
      .from(storeStaff)
      .innerJoin(store, eq(store.id, storeStaff.storeId))
      .where(eq(storeStaff.organizationId, orgId));
    const map = new Map<string, EmployeeStoreRef[]>();
    for (const r of rows) {
      const list = map.get(r.userId) ?? [];
      list.push({ id: r.id, name: r.name });
      map.set(r.userId, list);
    }
    return map;
  }

  /** Stores assigned to one user (for the register store-switcher). */
  async assignedStoresFor(
    orgId: string,
    userId: string,
  ): Promise<EmployeeStoreRef[]> {
    return this.db
      .select({ id: store.id, name: store.name })
      .from(storeStaff)
      .innerJoin(store, eq(store.id, storeStaff.storeId))
      .where(
        and(
          eq(storeStaff.organizationId, orgId),
          eq(storeStaff.userId, userId),
          isNull(store.deletedAt),
        ),
      );
  }

  /** All non-deleted stores of the org (switcher fallback for unassigned staff). */
  async allStores(orgId: string): Promise<EmployeeStoreRef[]> {
    return this.db
      .select({ id: store.id, name: store.name })
      .from(store)
      .where(and(eq(store.organizationId, orgId), isNull(store.deletedAt)));
  }

  /** Resolve store refs for a set of ids (for invitation `assignedStoreIds`). */
  async storesByIds(orgId: string, ids: string[]): Promise<EmployeeStoreRef[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select({ id: store.id, name: store.name })
      .from(store)
      .where(and(eq(store.organizationId, orgId), inArray(store.id, ids)));
    return rows;
  }

  // ── Member lookups ──────────────────────────────────────────────────────────
  async getMemberDetail(
    orgId: string,
    memberId: string,
  ): Promise<{ member: MemberRow; user: UserRow } | null> {
    const rows = await this.db
      .select({ member, user })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(
        and(
          eq(member.id, memberId),
          eq(member.organizationId, orgId),
          isNull(member.deletedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async getMemberByUserId(
    orgId: string,
    userId: string,
  ): Promise<MemberRow | null> {
    const rows = await this.db
      .select()
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findUserByEmail(email: string): Promise<UserRow | null> {
    const rows = await this.db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    return rows[0] ?? null;
  }

  async findUserById(userId: string): Promise<UserRow | null> {
    const rows = await this.db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Create a bare user (email only, no account/password) so magic-link sign-in
   *  works for an invitee in the passwordless admin. */
  async createUser(email: string): Promise<UserRow> {
    const rows = await this.db
      .insert(user)
      .values({ id: crypto.randomUUID(), email, emailVerified: false })
      .returning();
    return rows[0]!;
  }

  async countOwners(orgId: string): Promise<number> {
    const rows = await this.db
      .select({ id: member.id })
      .from(member)
      .where(
        and(
          eq(member.organizationId, orgId),
          eq(member.role, "owner"),
          isNull(member.deletedAt),
        ),
      );
    return rows.length;
  }

  // ── Member mutations ────────────────────────────────────────────────────────
  async patchMember(
    memberId: string,
    values: Partial<typeof member.$inferInsert>,
  ): Promise<void> {
    await this.db.update(member).set(values).where(eq(member.id, memberId));
  }

  async patchUser(
    userId: string,
    values: Partial<typeof user.$inferInsert>,
  ): Promise<void> {
    await this.db
      .update(user)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(user.id, userId));
  }

  async softDeleteMember(memberId: string): Promise<void> {
    await this.db
      .update(member)
      .set({ deletedAt: new Date() })
      .where(eq(member.id, memberId));
  }

  async createMember(values: {
    organizationId: string;
    userId: string;
    role: string;
  }): Promise<MemberRow> {
    const rows = await this.db
      .insert(member)
      .values({ id: crypto.randomUUID(), ...values })
      .returning();
    return rows[0]!;
  }

  // ── Store assignments ───────────────────────────────────────────────────────
  /** Replace a user's store assignments with `storeIds` (idempotent). */
  async setAssignments(
    orgId: string,
    userId: string,
    storeIds: string[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(storeStaff)
        .where(
          and(eq(storeStaff.organizationId, orgId), eq(storeStaff.userId, userId)),
        );
      if (storeIds.length > 0) {
        await tx.insert(storeStaff).values(
          storeIds.map((storeId) => ({
            id: crypto.randomUUID(),
            organizationId: orgId,
            userId,
            storeId,
          })),
        );
      }
    });
  }

  async assignedStoreIds(orgId: string, userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ storeId: storeStaff.storeId })
      .from(storeStaff)
      .where(
        and(eq(storeStaff.organizationId, orgId), eq(storeStaff.userId, userId)),
      );
    return rows.map((r) => r.storeId);
  }

  // ── Invitations ─────────────────────────────────────────────────────────────
  async createInvitation(values: {
    organizationId: string;
    email: string;
    role: string;
    inviterId: string;
    expiresAt: Date;
    assignedStoreIds: string[];
  }): Promise<InvitationRow> {
    const rows = await this.db
      .insert(invitation)
      .values({
        id: crypto.randomUUID(),
        status: "pending",
        ...values,
      })
      .returning();
    return rows[0]!;
  }

  async getInvitation(id: string): Promise<InvitationRow | null> {
    const rows = await this.db
      .select()
      .from(invitation)
      .where(eq(invitation.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async findPendingInvitationByEmail(
    orgId: string,
    email: string,
  ): Promise<InvitationRow | null> {
    const rows = await this.db
      .select()
      .from(invitation)
      .where(
        and(
          eq(invitation.organizationId, orgId),
          eq(invitation.email, email),
          eq(invitation.status, "pending"),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async setInvitationStatus(id: string, status: string): Promise<void> {
    await this.db
      .update(invitation)
      .set({ status })
      .where(eq(invitation.id, id));
  }

  // ── Stats (per store, a calendar month window) ───────────────────────────────
  async monthlyAgg(
    orgId: string,
    userId: string,
    from: Date,
    to: Date,
  ): Promise<Map<string, StoreAgg>> {
    const map = new Map<string, StoreAgg>();
    const get = (storeId: string | null): StoreAgg => {
      const key = storeId ?? "—";
      const agg = map.get(key) ?? emptyAgg();
      map.set(key, agg);
      return agg;
    };

    const sales = await this.db
      .select({
        storeId: purchase.storeId,
        count: sql<number>`count(*)`,
        amount: sql<number>`coalesce(sum(${purchase.priceCents}), 0)`,
      })
      .from(purchase)
      .where(
        and(
          eq(purchase.organizationId, orgId),
          eq(purchase.addedByUserId, userId),
          gte(purchase.createdAt, from),
          lt(purchase.createdAt, to),
        ),
      )
      .groupBy(purchase.storeId);
    for (const r of sales) {
      const a = get(r.storeId);
      a.sales = Number(r.count);
      a.salesAmountCents = Number(r.amount);
    }

    const stamps = await this.db
      .select({
        storeId: stamp.storeId,
        amount: sql<number>`coalesce(sum(${stamp.amount}), 0)`,
      })
      .from(stamp)
      .where(
        and(
          eq(stamp.addedByUserId, userId),
          gte(stamp.createdAt, from),
          lt(stamp.createdAt, to),
        ),
      )
      .groupBy(stamp.storeId);
    for (const r of stamps) get(r.storeId).stamps = Number(r.amount);

    const reds = await this.db
      .select({
        storeId: redemption.storeId,
        count: sql<number>`count(*)`,
      })
      .from(redemption)
      .where(
        and(
          eq(redemption.organizationId, orgId),
          eq(redemption.redeemedByUserId, userId),
          gte(redemption.createdAt, from),
          lt(redemption.createdAt, to),
        ),
      )
      .groupBy(redemption.storeId);
    for (const r of reds) get(r.storeId).redemptions = Number(r.count);

    const pts = await this.monthlyPoints(orgId, userId, from, to);
    for (const [storeId, val] of pts) get(storeId).pointsAwarded = val;

    return map;
  }

  /** Points earned per store, attributed via the earning purchase's cashier. */
  private async monthlyPoints(
    orgId: string,
    userId: string,
    from: Date,
    to: Date,
  ): Promise<Map<string, number>> {
    const rows = await this.db
      .select({
        storeId: purchase.storeId,
        points: sql<number>`coalesce(sum(${pointsTransaction.points}), 0)`,
      })
      .from(pointsTransaction)
      .innerJoin(purchase, eq(purchase.id, pointsTransaction.purchaseId))
      .where(
        and(
          eq(pointsTransaction.organizationId, orgId),
          eq(pointsTransaction.type, "earn"),
          eq(purchase.addedByUserId, userId),
          gte(pointsTransaction.createdAt, from),
          lt(pointsTransaction.createdAt, to),
        ),
      )
      .groupBy(purchase.storeId);
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.storeId ?? "—", Number(r.points));
    return map;
  }

  // ── Team leaderboard (per-employee aggregates for a window) ─────────────────
  async leaderboardAgg(
    orgId: string,
    from: Date,
    to: Date,
    storeIds?: string[],
  ): Promise<
    Map<
      string,
      {
        sales: number;
        revenueCents: number;
        maxTicketCents: number;
        uniqueCustomers: number;
        stamps: number;
        redemptions: number;
        points: number;
      }
    >
  > {
    const map = new Map<
      string,
      {
        sales: number;
        revenueCents: number;
        maxTicketCents: number;
        uniqueCustomers: number;
        stamps: number;
        redemptions: number;
        points: number;
      }
    >();
    const get = (userId: string) => {
      let agg = map.get(userId);
      if (!agg) {
        agg = {
          sales: 0,
          revenueCents: 0,
          maxTicketCents: 0,
          uniqueCustomers: 0,
          stamps: 0,
          redemptions: 0,
          points: 0,
        };
        map.set(userId, agg);
      }
      return agg;
    };
    const storeIn = storeIds?.length;

    const sales = await this.db
      .select({
        userId: purchase.addedByUserId,
        sales: sql<number>`count(*)`,
        revenue: sql<number>`coalesce(sum(${purchase.priceCents}), 0)`,
        maxTicket: sql<number>`coalesce(max(${purchase.priceCents}), 0)`,
        uniqueCustomers: sql<number>`count(distinct ${purchase.customerId})`,
      })
      .from(purchase)
      .where(
        and(
          eq(purchase.organizationId, orgId),
          gte(purchase.createdAt, from),
          lt(purchase.createdAt, to),
          storeIn ? inArray(purchase.storeId, storeIds!) : undefined,
        ),
      )
      .groupBy(purchase.addedByUserId);
    for (const r of sales) {
      const a = get(r.userId);
      a.sales = Number(r.sales);
      a.revenueCents = Number(r.revenue);
      a.maxTicketCents = Number(r.maxTicket);
      a.uniqueCustomers = Number(r.uniqueCustomers);
    }

    const stamps = await this.db
      .select({
        userId: stamp.addedByUserId,
        amount: sql<number>`coalesce(sum(${stamp.amount}), 0)`,
      })
      .from(stamp)
      .where(
        and(
          gte(stamp.createdAt, from),
          lt(stamp.createdAt, to),
          storeIn ? inArray(stamp.storeId, storeIds!) : undefined,
        ),
      )
      .groupBy(stamp.addedByUserId);
    for (const r of stamps) get(r.userId).stamps = Number(r.amount);

    const reds = await this.db
      .select({
        userId: redemption.redeemedByUserId,
        count: sql<number>`count(*)`,
      })
      .from(redemption)
      .where(
        and(
          eq(redemption.organizationId, orgId),
          gte(redemption.createdAt, from),
          lt(redemption.createdAt, to),
          storeIn ? inArray(redemption.storeId, storeIds!) : undefined,
        ),
      )
      .groupBy(redemption.redeemedByUserId);
    for (const r of reds) get(r.userId).redemptions = Number(r.count);

    const points = await this.db
      .select({
        userId: purchase.addedByUserId,
        points: sql<number>`coalesce(sum(${pointsTransaction.points}), 0)`,
      })
      .from(pointsTransaction)
      .innerJoin(purchase, eq(purchase.id, pointsTransaction.purchaseId))
      .where(
        and(
          eq(pointsTransaction.organizationId, orgId),
          eq(pointsTransaction.type, "earn"),
          gte(pointsTransaction.createdAt, from),
          lt(pointsTransaction.createdAt, to),
          storeIn ? inArray(purchase.storeId, storeIds!) : undefined,
        ),
      )
      .groupBy(purchase.addedByUserId);
    for (const r of points) get(r.userId).points = Number(r.points);

    return map;
  }

  // ── Activity feed ───────────────────────────────────────────────────────────
  /** Audit-log rows for a target user (auth + admin events). Capped. */
  async auditEvents(
    orgId: string,
    userId: string,
    cap: number,
  ): Promise<ActivityEntry[]> {
    const rows = await this.db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.organizationId, orgId),
          eq(auditLog.targetUserId, userId),
        ),
      )
      .orderBy(desc(auditLog.createdAt))
      .limit(cap);
    return rows.map((r) => ({
      id: r.id,
      type: r.type as AuditType,
      createdAt: r.createdAt,
      metadata: r.metadata ?? null,
    }));
  }

  /** Loyalty events performed by the user (sale/stamp/redemption). Capped each. */
  async loyaltyEvents(
    orgId: string,
    userId: string,
    cap: number,
  ): Promise<ActivityEntry[]> {
    const sales = await this.db
      .select({
        id: purchase.id,
        createdAt: purchase.createdAt,
        amount: purchase.priceCents,
        storeId: purchase.storeId,
        storeName: store.name,
        customerName: customer.name,
        customerPhone: customer.phone,
      })
      .from(purchase)
      .leftJoin(store, eq(store.id, purchase.storeId))
      .leftJoin(customer, eq(customer.id, purchase.customerId))
      .where(
        and(
          eq(purchase.organizationId, orgId),
          eq(purchase.addedByUserId, userId),
        ),
      )
      .orderBy(desc(purchase.createdAt))
      .limit(cap);

    const reds = await this.db
      .select({
        id: redemption.id,
        createdAt: redemption.createdAt,
        rewardName: reward.name,
        storeId: redemption.storeId,
        storeName: store.name,
        customerName: customer.name,
        customerPhone: customer.phone,
      })
      .from(redemption)
      .leftJoin(reward, eq(reward.id, redemption.rewardId))
      .leftJoin(store, eq(store.id, redemption.storeId))
      .leftJoin(customer, eq(customer.id, redemption.customerId))
      .where(
        and(
          eq(redemption.organizationId, orgId),
          eq(redemption.redeemedByUserId, userId),
        ),
      )
      .orderBy(desc(redemption.createdAt))
      .limit(cap);

    const out: ActivityEntry[] = [];
    for (const s of sales) {
      out.push({
        id: `sale:${s.id}`,
        type: "sale",
        createdAt: s.createdAt,
        metadata: {
          amountCents: s.amount,
          storeId: s.storeId,
          storeName: s.storeName,
          customerName: s.customerName ?? s.customerPhone,
        },
      });
    }
    for (const r of reds) {
      out.push({
        id: `redemption:${r.id}`,
        type: "redemption",
        createdAt: r.createdAt,
        metadata: {
          rewardName: r.rewardName,
          storeId: r.storeId,
          storeName: r.storeName,
          customerName: r.customerName ?? r.customerPhone,
        },
      });
    }
    return out;
  }
}

export type { EmployeeDetail, EmployeeListItem };
