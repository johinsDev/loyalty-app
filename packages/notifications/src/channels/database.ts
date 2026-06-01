import { normalizeContract } from "../messages/base-channel-message";
import type { DatabaseContract } from "../messages/contracts";
import type { Notification, NotificationRenderers } from "../notification";
import type {
  ChannelResult,
  NotificationCategory,
  ResolvedNotifiable,
} from "../types";
import type { NotificationChannel } from "./channel";

/** Row the database channel persists. The concrete repo lives app-side. */
export interface DatabaseNotificationInput {
  customerId: string;
  organizationId: string;
  type: string;
  title: string;
  body: string;
  category: NotificationCategory;
  data?: Record<string, unknown>;
}

/**
 * Persists in-app notifications so they can be read / marked-read later. The
 * concrete Drizzle implementation lives in the app/jobs bootstrap.
 */
export interface DatabaseNotificationRepository {
  create(input: DatabaseNotificationInput): Promise<{ id: string }>;
}

/**
 * Writes the notification to the in-app feed. Unlike the other channels this
 * does not wrap a `@loyalty/*` transport — it persists via an injected repo.
 * The notification's `category` is propagated automatically (authors don't
 * repeat it in the contract).
 */
export class DatabaseChannel implements NotificationChannel {
  readonly name = "database";
  readonly method = "toDatabase" as const;

  constructor(private readonly repository: DatabaseNotificationRepository) {}

  async send(
    notification: Notification,
    notifiable: ResolvedNotifiable,
  ): Promise<ChannelResult> {
    const render = notification as NotificationRenderers;
    if (!render.toDatabase) {
      return { channel: this.name, status: "skipped", reason: "no-method" };
    }
    const contract = await normalizeContract<DatabaseContract>(
      await render.toDatabase(notifiable),
    );
    const row = await this.repository.create({
      customerId: notifiable.customerId,
      organizationId: notifiable.organizationId,
      type: contract.type,
      title: contract.title,
      body: contract.body,
      category: notification.category,
      data: contract.data,
    });
    return { channel: this.name, status: "sent", response: row };
  }
}
