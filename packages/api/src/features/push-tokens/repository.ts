import type { db as Db } from "@loyalty/db";
import { pushToken, type PushTokenRow } from "@loyalty/db/schema";
import { and, eq, sql } from "drizzle-orm";

import type { RegisterInput } from "./schemas";

export class PushTokenRepository {
  constructor(private readonly db: typeof Db) {}

  /**
   * INSERT … ON CONFLICT (customer_id, organization_id, token) DO
   * UPDATE — re-activating an existing token + bumping `last_used_at`
   * is the common path (browser re-subscribes on each tab open).
   */
  async upsert(input: RegisterInput): Promise<PushTokenRow> {
    const now = new Date();
    const rows = (await this.db
      .insert(pushToken)
      .values({
        customerId: input.customerId,
        organizationId: input.organizationId,
        platform: input.platform,
        token: input.token,
        deviceLabel: input.deviceLabel ?? null,
        isActive: true,
        lastUsedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [pushToken.customerId, pushToken.organizationId, pushToken.token],
        set: {
          isActive: true,
          lastUsedAt: now,
          updatedAt: now,
          deviceLabel: input.deviceLabel ?? null,
        },
      })
      .returning()) as PushTokenRow[];
    const inserted = rows[0];
    if (!inserted) throw new Error("push_token upsert returned no rows");
    return inserted;
  }

  async listActiveForCustomer(
    customerId: string,
    organizationId: string,
  ): Promise<PushTokenRow[]> {
    return this.db
      .select()
      .from(pushToken)
      .where(
        and(
          eq(pushToken.customerId, customerId),
          eq(pushToken.organizationId, organizationId),
          eq(pushToken.isActive, true),
        ),
      );
  }

  async revoke(
    customerId: string,
    organizationId: string,
    token: string,
  ): Promise<number> {
    const result = await this.db
      .update(pushToken)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(pushToken.customerId, customerId),
          eq(pushToken.organizationId, organizationId),
          eq(pushToken.token, token),
        ),
      );
    return result.rowCount ?? 0;
  }

  /**
   * Called from the auto sender when a transport reports the
   * subscription has expired (HTTP 410 / DeviceNotRegistered). Scoped
   * by token only — the auto sender doesn't have customer context.
   */
  async deactivateByToken(token: string): Promise<number> {
    const result = await this.db
      .update(pushToken)
      .set({ isActive: false, updatedAt: sql`NOW()` })
      .where(eq(pushToken.token, token));
    return result.rowCount ?? 0;
  }
}
