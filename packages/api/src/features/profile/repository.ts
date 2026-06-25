import type { db as Db } from "@loyalty/db";
import {
  account,
  customer,
  type CustomerRow,
  purchase,
  user,
} from "@loyalty/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";

/** Avatar columns, kept mutually exclusive by the service. */
export interface AvatarPatch {
  avatarPreset: string | null;
  avatarUrl: string | null;
  avatarThumbhash: string | null;
}

/**
 * Drizzle access for the customer profile. The `customer` row is the org-scoped
 * source of truth for name / nickname / avatar / phone / email; visits come from
 * the `purchase` ledger and the Google link from the Better Auth `account` table.
 * Only layer that touches the db.
 */
export class ProfileRepository {
  constructor(private readonly db: typeof Db) {}

  async get(
    orgId: string,
    customerId: string,
  ): Promise<CustomerRow | undefined> {
    const rows = await this.db
      .select()
      .from(customer)
      .where(
        and(eq(customer.organizationId, orgId), eq(customer.id, customerId)),
      )
      .limit(1);
    return rows[0];
  }

  /** Whether `nickname` (already lowercased) is taken by ANOTHER customer in
   *  the org. */
  async nicknameTaken(
    orgId: string,
    nickname: string,
    excludeId: string,
  ): Promise<boolean> {
    const rows = await this.db
      .select({ id: customer.id })
      .from(customer)
      .where(
        and(
          eq(customer.organizationId, orgId),
          eq(customer.nickname, nickname),
          ne(customer.id, excludeId),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async updateName(
    orgId: string,
    customerId: string,
    name: string,
  ): Promise<void> {
    await this.db
      .update(customer)
      .set({ name, updatedAt: new Date() })
      .where(
        and(eq(customer.organizationId, orgId), eq(customer.id, customerId)),
      );
  }

  async updateNickname(
    orgId: string,
    customerId: string,
    nickname: string,
  ): Promise<void> {
    await this.db
      .update(customer)
      .set({ nickname, updatedAt: new Date() })
      .where(
        and(eq(customer.organizationId, orgId), eq(customer.id, customerId)),
      );
  }

  async updateAvatar(
    orgId: string,
    customerId: string,
    patch: AvatarPatch,
  ): Promise<void> {
    await this.db
      .update(customer)
      .set({ ...patch, updatedAt: new Date() })
      .where(
        and(eq(customer.organizationId, orgId), eq(customer.id, customerId)),
      );
  }

  async updatePhone(
    orgId: string,
    customerId: string,
    phone: string,
  ): Promise<void> {
    await this.db
      .update(customer)
      .set({ phone, updatedAt: new Date() })
      .where(
        and(eq(customer.organizationId, orgId), eq(customer.id, customerId)),
      );
  }

  async updateEmail(
    orgId: string,
    customerId: string,
    email: string,
  ): Promise<void> {
    await this.db
      .update(customer)
      .set({ email, updatedAt: new Date() })
      .where(
        and(eq(customer.organizationId, orgId), eq(customer.id, customerId)),
      );
  }

  async visitCount(orgId: string, customerId: string): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(purchase)
      .where(
        and(
          eq(purchase.organizationId, orgId),
          eq(purchase.customerId, customerId),
        ),
      );
    return rows[0]?.count ?? 0;
  }

  /** The user's current Better Auth `phoneNumber` (the login identifier,
   *  swapped client-side on a phone change). */
  async userPhoneNumber(userId: string): Promise<string | null> {
    const rows = await this.db
      .select({ phone: user.phoneNumber })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows[0]?.phone ?? null;
  }

  /** Whether a Google account is linked to this user (`customer.id === user.id`). */
  async googleLinked(userId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: account.id })
      .from(account)
      .where(
        and(eq(account.userId, userId), eq(account.providerId, "google")),
      )
      .limit(1);
    return rows.length > 0;
  }
}
