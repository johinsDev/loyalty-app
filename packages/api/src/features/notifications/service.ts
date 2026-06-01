import { tasks } from "@trigger.dev/sdk/v3";
import { TRPCError } from "@trpc/server";

import type { DrizzleNotificationPreferences } from "./preferences-repository";
import type { FeedResult, NotificationRepository } from "./repository";
import type {
  ListCustomersInput,
  ListMineInput,
  NotificationKey,
  PreferenceChannel,
  SendInput,
} from "./schemas";
import { preferenceChannelSchema } from "./schemas";

// Untyped trigger by ID — typing the payload would require @loyalty/api to
// depend on @loyalty/jobs, but jobs already depends on api (cycle). The shape
// stays in sync with packages/jobs/trigger/send-notification.ts.
type SendNotificationPayload = {
  customerIds: string[];
  organizationId: string;
  notificationKey: NotificationKey;
  payload?: Record<string, unknown>;
};

export interface ChannelPreference {
  channel: PreferenceChannel;
  marketingEnabled: boolean;
}

/**
 * Business logic for the notifications feature: the customer's in-app feed,
 * their per-channel marketing preferences, the admin customer picker, and
 * enqueuing a send through Trigger.dev (the Notifier runs in the job, never
 * inline in a request).
 */
export class NotificationService {
  constructor(
    private readonly repo: NotificationRepository,
    private readonly preferences: DrizzleNotificationPreferences,
  ) {}

  listMine(
    customerId: string,
    organizationId: string,
    input: ListMineInput,
  ): Promise<FeedResult> {
    return this.repo.listForCustomer(
      customerId,
      organizationId,
      input.filter,
      input.page,
      input.pageSize,
    );
  }

  unreadCount(customerId: string, organizationId: string): Promise<number> {
    return this.repo.unreadCount(customerId, organizationId);
  }

  async markRead(id: string, customerId: string): Promise<{ ok: true }> {
    const affected = await this.repo.markRead(id, customerId);
    if (affected === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `notification "${id}" not found or already read`,
      });
    }
    return { ok: true };
  }

  async markAllRead(
    customerId: string,
    organizationId: string,
  ): Promise<{ updated: number }> {
    const updated = await this.repo.markAllRead(customerId, organizationId);
    return { updated };
  }

  async remove(id: string, customerId: string): Promise<{ ok: true }> {
    const affected = await this.repo.delete(id, customerId);
    if (affected === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `notification "${id}" not found`,
      });
    }
    return { ok: true };
  }

  async removeAll(
    customerId: string,
    organizationId: string,
  ): Promise<{ deleted: number }> {
    const deleted = await this.repo.deleteAll(customerId, organizationId);
    return { deleted };
  }

  /** Every manageable channel with its current marketing flag (default on). */
  async getMyPreferences(
    customerId: string,
    organizationId: string,
  ): Promise<ChannelPreference[]> {
    const rows = await this.preferences.listForCustomer(
      customerId,
      organizationId,
    );
    const byChannel = new Map(rows.map((r) => [r.channel, r.marketingEnabled]));
    return preferenceChannelSchema.options.map((channel) => ({
      channel,
      marketingEnabled: byChannel.get(channel) ?? true,
    }));
  }

  async setPreference(
    customerId: string,
    organizationId: string,
    channel: PreferenceChannel,
    marketingEnabled: boolean,
  ): Promise<{ ok: true }> {
    await this.preferences.setMarketingEnabled(
      customerId,
      organizationId,
      channel,
      marketingEnabled,
    );
    return { ok: true };
  }

  listCustomers(organizationId: string, input: ListCustomersInput) {
    return this.repo.listCustomers(organizationId, input);
  }

  /** Enqueue a Trigger.dev run that fans the notification out per customer. */
  async send(
    organizationId: string,
    input: SendInput,
  ): Promise<{ enqueued: number }> {
    const payload: SendNotificationPayload = {
      customerIds: input.customerIds,
      organizationId,
      notificationKey: input.notificationKey,
      payload: input.payload,
    };
    await tasks.trigger("send-notification", payload);
    return { enqueued: input.customerIds.length };
  }
}
