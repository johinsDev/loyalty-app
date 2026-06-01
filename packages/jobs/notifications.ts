import {
  DrizzleNotifiableRepository,
  DrizzleNotificationPreferences,
  NotificationRepository,
} from "@loyalty/api/features/notifications";
import { db } from "@loyalty/db";
import {
  DatabaseChannel,
  MailChannel,
  Notifier,
  PushChannel,
  RealtimeChannel,
  SmsChannel,
  WhatsAppChannel,
} from "@loyalty/notifications";

import { email } from "./email";
import { log } from "./log";
import { push } from "./push";
import { realtime } from "./realtime";
import { sms } from "./sms";
import { whatsapp } from "./whatsapp";

/**
 * Notifier bootstrap for Trigger.dev tasks. Wires every channel to its
 * injected `@loyalty/*` manager and the Drizzle repos that resolve recipients,
 * preferences, and persist in-app notifications. The managers each pick their
 * own provider by env (log local / outbox preview / real prod), so the
 * Notifier inherits that policy for free.
 *
 * Lazy: built on first use so `trigger deploy` can index task files with no
 * env present.
 */
function build(): Notifier {
  return new Notifier({
    channels: {
      mail: new MailChannel(email),
      sms: new SmsChannel(sms),
      push: new PushChannel(push),
      whatsapp: new WhatsAppChannel(whatsapp),
      realtime: new RealtimeChannel(realtime),
      database: new DatabaseChannel(new NotificationRepository(db)),
    },
    notifiables: new DrizzleNotifiableRepository(db),
    preferences: new DrizzleNotificationPreferences(db),
    logger: log,
  });
}

let cached: Notifier | undefined;

export const notifier = new Proxy({} as Notifier, {
  get(_target, prop) {
    cached ??= build();
    const value = (cached as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(cached) : value;
  },
});
