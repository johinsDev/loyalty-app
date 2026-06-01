import type { ChannelRegistry } from "./channels/channel";
import { FakeNotifier } from "./fake-notifier";
import type { NotifiableRepository } from "./notifiable";
import { isFullyResolved } from "./notifiable";
import type { Notification } from "./notification";
import type { PreferencesRepository } from "./preferences";
import { resolveChannels } from "./preferences";
import type {
  ChannelName,
  ChannelResult,
  NotifiableInput,
  NotifierLogLevel,
  NotifierLogger,
  ResolvedNotifiable,
  SendResult,
} from "./types";

export interface NotifierConfig {
  /** Channels injected by the bootstrap, keyed by name. */
  channels: ChannelRegistry;
  /** Resolves a recipient's contact info. */
  notifiables: NotifiableRepository;
  /** Resolves per-channel opt-outs. */
  preferences: PreferencesRepository;
  logger?: NotifierLogger;
  /** Defaults to `info`. `silent` suppresses internal `[notifications]` lines. */
  logLevel?: NotifierLogLevel;
}

/**
 * Orchestrates a single `Notification` across many channels: resolves the
 * recipient, filters channels by preference, fans out with per-channel error
 * isolation, and aggregates the results.
 *
 * @example
 *   const result = await notifier.send(
 *     { customerId, organizationId },
 *     new NewUserNotification(name),
 *   );
 */
export class Notifier {
  readonly #channels: ChannelRegistry;
  readonly #notifiables: NotifiableRepository;
  readonly #preferences: PreferencesRepository;
  readonly #logger?: NotifierLogger;
  readonly #logLevel: NotifierLogLevel;
  #fake?: FakeNotifier;

  constructor(config: NotifierConfig) {
    this.#channels = config.channels;
    this.#notifiables = config.notifiables;
    this.#preferences = config.preferences;
    this.#logger = config.logger;
    this.#logLevel = config.logLevel ?? "info";
  }

  async send(
    target: NotifiableInput,
    notification: Notification,
  ): Promise<SendResult> {
    if (this.#fake) return this.#fake.send(target, notification);

    const who = await this.#resolve(target);
    const declared = [...(await notification.via(who))];

    const allowed = await resolveChannels({
      declared,
      category: notification.category,
      customerId: who.customerId,
      organizationId: who.organizationId,
      preferences: this.#preferences,
    });

    const results = await Promise.all(
      declared.map((name) => this.#sendOne(name, allowed, notification, who)),
    );

    const ok = results.every((r) => r.status !== "failed");
    this.#log("info", {
      notification: notification.constructor.name,
      customerId: who.customerId,
      category: notification.category,
      results: results.map((r) => ({ channel: r.channel, status: r.status })),
      ok,
    });

    return {
      notification: notification.constructor.name,
      customerId: who.customerId,
      category: notification.category,
      results,
      ok,
    };
  }

  async #sendOne(
    name: ChannelName,
    allowed: Set<ChannelName>,
    notification: Notification,
    who: ResolvedNotifiable,
  ): Promise<ChannelResult> {
    if (!allowed.has(name)) {
      return { channel: name, status: "skipped", reason: "opted-out" };
    }
    const channel = this.#channels[name];
    if (!channel) {
      return { channel: name, status: "skipped", reason: "not-registered" };
    }
    try {
      return await channel.send(notification, who);
    } catch (error) {
      this.#log("error", { channel: name, error: String(error) });
      return { channel: name, status: "failed", error: error as Error };
    }
  }

  async #resolve(target: NotifiableInput): Promise<ResolvedNotifiable> {
    if (isFullyResolved(target)) {
      return {
        customerId: target.customerId,
        organizationId: target.organizationId,
        phone: target.phone,
        email: target.email ?? null,
        name: target.name ?? null,
      };
    }
    const resolved = await this.#notifiables.resolve(
      target.customerId,
      target.organizationId,
    );
    if (!resolved) {
      throw new Error(
        `Notifiable customer "${target.customerId}" not found in org "${target.organizationId}"`,
      );
    }
    return resolved;
  }

  /** Activate the fake notifier. Subsequent `send()` records instead of delivering. */
  fake(): FakeNotifier {
    this.restore();
    this.#fake = new FakeNotifier();
    return this.#fake;
  }

  /** Disable fake mode (cleans up after tests). */
  restore(): void {
    this.#fake = undefined;
  }

  #log(
    level: "info" | "error",
    bindings: Record<string, unknown>,
  ): void {
    if (this.#logLevel === "silent") return;
    if (this.#logger) {
      this.#logger[level === "error" ? "error" : "info"](
        { ...bindings, _service: "notifications" },
        level === "error" ? "channel failed" : "sent",
      );
      return;
    }
    console.log("[notifications]", bindings);
  }
}
