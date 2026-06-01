import { normalizeContract } from "../messages/base-channel-message";
import type { RealtimeContract } from "../messages/contracts";
import type { Notification, NotificationRenderers } from "../notification";
import type { ChannelResult, ResolvedNotifiable } from "../types";
import type { NotificationChannel } from "./channel";

/**
 * Structural slice of `@loyalty/realtime`'s `RealtimeClient.publish`. Both the
 * real client and `FakeRealtime` satisfy this.
 */
export interface RealtimeGateway {
  publish(
    room: `customer:${string}` | `org:${string}`,
    event: { event: string; data: Record<string, unknown> },
  ): Promise<void>;
}

/**
 * Adapts `Notification.toRealtime()` to an injected realtime publisher.
 * Defaults the room to `customer:<customerId>`.
 */
export class RealtimeChannel implements NotificationChannel {
  readonly name = "realtime";
  readonly method = "toRealtime" as const;

  constructor(private readonly realtime: RealtimeGateway) {}

  async send(
    notification: Notification,
    notifiable: ResolvedNotifiable,
  ): Promise<ChannelResult> {
    const render = notification as NotificationRenderers;
    if (!render.toRealtime) {
      return { channel: this.name, status: "skipped", reason: "no-method" };
    }
    const contract = await normalizeContract<RealtimeContract>(
      await render.toRealtime(notifiable),
    );
    const room = contract.room ?? `customer:${notifiable.customerId}`;
    await this.realtime.publish(room, {
      event: contract.event,
      data: contract.data,
    });
    return { channel: this.name, status: "sent", response: { room } };
  }
}
