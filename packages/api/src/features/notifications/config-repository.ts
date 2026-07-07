import type { db as Db } from "@loyalty/db";
import { notificationConfig, type NotificationConfigRow } from "@loyalty/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Drizzle access for `notification_config` — the per-org automated-trigger
 * overrides the send-notification job consults. Absence of a row = code defaults.
 */
export class NotificationConfigRepository {
  constructor(private readonly db: typeof Db) {}

  async get(orgId: string, key: string): Promise<NotificationConfigRow | null> {
    const rows = await this.db
      .select()
      .from(notificationConfig)
      .where(
        and(
          eq(notificationConfig.organizationId, orgId),
          eq(notificationConfig.notificationKey, key),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async list(orgId: string): Promise<NotificationConfigRow[]> {
    return this.db
      .select()
      .from(notificationConfig)
      .where(eq(notificationConfig.organizationId, orgId));
  }

  async upsert(
    orgId: string,
    key: string,
    values: { enabled: boolean; channels: string[] | null },
  ): Promise<NotificationConfigRow> {
    const rows = await this.db
      .insert(notificationConfig)
      .values({
        organizationId: orgId,
        notificationKey: key,
        enabled: values.enabled,
        channels: values.channels,
      })
      .onConflictDoUpdate({
        target: [notificationConfig.organizationId, notificationConfig.notificationKey],
        set: {
          enabled: values.enabled,
          channels: values.channels,
          updatedAt: new Date(),
        },
      })
      .returning();
    return rows[0]!;
  }
}
