import type { db as Db } from "@loyalty/db";
import {
  notificationPreference,
  type NotificationPreferenceRow,
} from "@loyalty/db/schema";
import type { ChannelName, PreferencesRepository } from "@loyalty/notifications";
import { and, eq } from "drizzle-orm";

/**
 * Drizzle implementation of the engine's `PreferencesRepository` plus the
 * customer-facing read/write the profile UI needs. A row with
 * `marketingEnabled = false` is an opt-out; no row means subscribed.
 */
export class DrizzleNotificationPreferences implements PreferencesRepository {
  constructor(private readonly db: typeof Db) {}

  /** Engine hook: channels the customer opted out of (marketing). */
  async optedOutChannels(
    customerId: string,
    organizationId: string,
  ): Promise<Set<ChannelName>> {
    const rows = await this.db
      .select({ channel: notificationPreference.channel })
      .from(notificationPreference)
      .where(
        and(
          eq(notificationPreference.customerId, customerId),
          eq(notificationPreference.organizationId, organizationId),
          eq(notificationPreference.marketingEnabled, false),
        ),
      );
    return new Set(rows.map((r) => r.channel));
  }

  /** Every stored preference row for the customer (UI merges defaults). */
  listForCustomer(
    customerId: string,
    organizationId: string,
  ): Promise<NotificationPreferenceRow[]> {
    return this.db
      .select()
      .from(notificationPreference)
      .where(
        and(
          eq(notificationPreference.customerId, customerId),
          eq(notificationPreference.organizationId, organizationId),
        ),
      );
  }

  /** Upsert one channel's marketing flag. */
  async setMarketingEnabled(
    customerId: string,
    organizationId: string,
    channel: string,
    marketingEnabled: boolean,
  ): Promise<void> {
    await this.db
      .insert(notificationPreference)
      .values({ customerId, organizationId, channel, marketingEnabled })
      .onConflictDoUpdate({
        target: [
          notificationPreference.customerId,
          notificationPreference.organizationId,
          notificationPreference.channel,
        ],
        set: { marketingEnabled, updatedAt: new Date() },
      });
  }
}
