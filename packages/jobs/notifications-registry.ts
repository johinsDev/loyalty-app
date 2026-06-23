import type { NotificationKey } from "@loyalty/api/features/notifications";
import {
  BaseChannelMessage,
  type ChannelName,
  Notification,
  type NotifiableInput,
  type NotificationRenderers,
  type SmsContract,
} from "@loyalty/notifications";

/**
 * Maps an admin-selectable `notificationKey` to a `Notification` instance.
 * The Trigger.dev task resolves a class from here (the payload is untyped on
 * the wire to avoid an api → jobs cycle). Add a new notification by:
 *   1. adding its class below,
 *   2. registering it in `REGISTRY`,
 *   3. extending the `notificationKey` enum in
 *      `packages/api/src/features/notifications/schemas.ts`.
 */

type NotifiableLike = Pick<NotifiableInput, "name">;

/** Class-style channel message — demonstrates `toSms() { return new NewUserSms() }`. */
class NewUserSms extends BaseChannelMessage<SmsContract> {
  constructor(private readonly name: string | null) {
    super();
  }
  toContract(): SmsContract {
    const who = this.name ?? "";
    return { body: `¡Bienvenido a T4${who ? `, ${who}` : ""}! 🧋` };
  }
}

/** Transactional welcome — always sends (ignores marketing opt-out). */
export class NewUserNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "transactional" as const;

  via(): ChannelName[] {
    return ["mail", "database", "push", "sms", "whatsapp", "realtime"];
  }

  toMail(n: NotifiableLike) {
    const who = n.name ?? "";
    return {
      subject: "¡Bienvenido a T4 Diver Club!",
      html: `<p>Hola${who ? ` ${who}` : ""}, gracias por unirte a T4 Diver Club. Sumá sellos y canjeá premios. 🧋</p>`,
    };
  }

  toSms(n: NotifiableLike) {
    return new NewUserSms(n.name ?? null);
  }

  toWhatsApp(n: NotifiableLike) {
    const who = n.name ?? "";
    return {
      body: `¡Bienvenido a T4 Diver Club${who ? `, ${who}` : ""}! 🧋 Sumá sellos en cada compra y canjeá tu bubble tea de regalo.`,
    };
  }

  toPush(n: NotifiableLike) {
    const who = n.name ?? "";
    return {
      title: "¡Bienvenido a T4!",
      body: `Hola${who ? ` ${who}` : ""}, tu tarjeta digital te espera.`,
      data: { kind: "welcome" },
    };
  }

  toDatabase() {
    return {
      type: "welcome",
      title: "¡Bienvenido a T4 Diver Club!",
      body: "Sumá sellos en cada compra y canjeá tu bubble tea de regalo.",
    };
  }

  toRealtime() {
    return {
      event: "notification",
      data: {
        type: "welcome",
        title: "¡Bienvenido a T4 Diver Club!",
        body: "Sumá sellos en cada compra y canjeá tu bubble tea de regalo.",
      },
    };
  }
}

/**
 * First-purchase celebration — transactional, surfaced in-app via the
 * `database` (feed) + `realtime` (live) channels and as a push. The web app
 * pops a confetti celebration on entry when it sees a `first-purchase` row.
 */
export class FirstPurchaseNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "transactional" as const;

  via(): ChannelName[] {
    return ["database", "realtime", "push"];
  }

  toDatabase() {
    return {
      type: "first-purchase",
      title: "¡Tu primera compra! 🎉",
      body: "Sumaste tu primer sello. Te faltan 9 para tu bebida gratis. 🧋",
      data: { stamps: 1 },
    };
  }

  toRealtime() {
    return {
      event: "notification",
      data: {
        type: "first-purchase",
        title: "¡Tu primera compra! 🎉",
        body: "Sumaste tu primer sello · +1 🧋",
      },
    };
  }

  toPush() {
    return {
      title: "¡Tu primera compra! 🎉",
      body: "Sumaste tu primer sello. Tu tarjeta ya está en marcha.",
      data: { kind: "first-purchase" },
    };
  }
}

/** Marketing promo — respects per-channel marketing opt-out. */
export class PromoNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "marketing" as const;

  constructor(
    private readonly title = "2x1 en bubble tea hoy 🧋",
    private readonly body = "Solo por hoy: traé a un amigo y el segundo va de regalo.",
  ) {
    super();
  }

  via(): ChannelName[] {
    return ["mail", "sms", "push", "whatsapp", "database"];
  }

  toMail() {
    return {
      subject: this.title,
      html: `<p>${this.body}</p>`,
    };
  }

  toSms() {
    return { body: `${this.title}\n${this.body}` };
  }

  toPush() {
    return { title: this.title, body: this.body };
  }

  toWhatsApp() {
    return { body: `${this.title}\n${this.body}` };
  }

  toDatabase() {
    return { type: "promo", title: this.title, body: this.body };
  }
}

/**
 * Stamp earned — transactional. Realtime fires inline in the sellos service for
 * an instant card animation; this job carries the durable channels: WhatsApp +
 * the in-app feed (`database`).
 */
export class StampEarnedNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "transactional" as const;

  constructor(
    private readonly currentStamps: number,
    private readonly walletSize: number,
    private readonly completed: boolean,
  ) {
    super();
  }

  via(): ChannelName[] {
    return ["whatsapp", "database"];
  }

  #title(): string {
    return this.completed ? "¡Completaste tu tarjeta! 🎉" : "¡Sumaste un sello! 🧋";
  }

  #body(): string {
    if (this.completed) {
      return "Tenés un premio para reclamar. Mostrá tu código en la caja.";
    }
    const remaining = Math.max(0, this.walletSize - this.currentStamps);
    return `Llevás ${this.currentStamps}/${this.walletSize}. Te ${
      remaining === 1 ? "falta 1 sello" : `faltan ${remaining} sellos`
    } para tu premio.`;
  }

  toWhatsApp() {
    return { body: `${this.#title()}\n${this.#body()}` };
  }

  toDatabase() {
    return {
      type: "stamp-earned",
      title: this.#title(),
      body: this.#body(),
      data: {
        currentStamps: this.currentStamps,
        walletSize: this.walletSize,
        completed: this.completed,
      },
    };
  }
}

/** Reward claimed — transactional confirmation (WhatsApp + in-app feed). */
export class RewardClaimedNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "transactional" as const;

  via(): ChannelName[] {
    return ["whatsapp", "database"];
  }

  toWhatsApp() {
    return {
      body: "¡Reclamaste tu premio! 🎉 Gracias por ser parte de T4. Tu nueva tarjeta ya empezó.",
    };
  }

  toDatabase() {
    return {
      type: "reward-claimed",
      title: "¡Premio reclamado! 🎉",
      body: "Disfrutá tu premio. Tu nueva tarjeta ya empezó a sumar.",
    };
  }
}

/** Builds a notification from its key + the admin-supplied payload. */
export function createNotification(
  key: NotificationKey,
  payload?: Record<string, unknown>,
): Notification {
  switch (key) {
    case "new-user":
      return new NewUserNotification();
    case "first-purchase":
      return new FirstPurchaseNotification();
    case "promo": {
      const title =
        typeof payload?.title === "string" ? payload.title : undefined;
      const body = typeof payload?.body === "string" ? payload.body : undefined;
      return new PromoNotification(title, body);
    }
    case "stamp-earned": {
      const currentStamps =
        typeof payload?.currentStamps === "number" ? payload.currentStamps : 0;
      const walletSize =
        typeof payload?.walletSize === "number" ? payload.walletSize : 10;
      const completed = payload?.completed === true;
      return new StampEarnedNotification(currentStamps, walletSize, completed);
    }
    case "reward-claimed":
      return new RewardClaimedNotification();
  }
}
