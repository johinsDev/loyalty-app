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
      body: "Sumaste tu primer sello. Seguí sumando para tu bebida gratis. 🧋",
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
    private readonly stampsGoal: number,
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
      return "¡Tu bebida gratis te espera! Mostrá tu código en la caja para reclamarla.";
    }
    const remaining = Math.max(0, this.stampsGoal - this.currentStamps);
    return `Llevás ${this.currentStamps}/${this.stampsGoal}. Te ${
      remaining === 1 ? "falta 1 sello" : `faltan ${remaining} sellos`
    } para tu bebida gratis.`;
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
        stampsGoal: this.stampsGoal,
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

  constructor(private readonly rewardName: string | null = null) {
    super();
  }

  #what(): string {
    return this.rewardName ? `"${this.rewardName}"` : "tu premio";
  }

  via(): ChannelName[] {
    return ["whatsapp", "database"];
  }

  toWhatsApp() {
    return {
      body: `¡Reclamaste ${this.#what()}! 🎉 Gracias por ser parte de T4. Seguí sumando para el próximo.`,
    };
  }

  toDatabase() {
    return {
      type: "reward-claimed",
      title: "¡Premio reclamado! 🎉",
      body: `Disfrutá ${this.#what()}. Seguí sumando para tu próximo premio.`,
    };
  }
}

/**
 * Reward claim code — the 6-digit OTP for the cashier-initiated, no-scanner
 * claim path. Delivered out-of-band so the cashier validates the customer is
 * present; transactional, WhatsApp + push. Mirrors an OTP message: short-lived,
 * "don't share". Realtime fires inline in the service (`reward.claim-code`).
 */
export class RewardClaimCodeNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "transactional" as const;

  constructor(
    private readonly rewardName: string,
    private readonly code: string,
  ) {
    super();
  }

  via(): ChannelName[] {
    return ["whatsapp", "push"];
  }

  toWhatsApp() {
    return {
      body: `Tu código para reclamar ${this.rewardName} es: ${this.code}\nExpira en 3 minutos. No lo compartas.`,
    };
  }

  toPush() {
    return {
      title: "Tu código para reclamar 🎁",
      body: `${this.rewardName}: ${this.code}. Expira en 3 minutos.`,
      data: { kind: "reward-claim-code" },
    };
  }
}

/**
 * Streak completed — the big moment. Realtime fires inline in the streaks
 * service for the instant celebration; this job carries WhatsApp + the in-app
 * feed + push, all nudging "no olvides reclamar".
 */
export class StreakCompletedNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "transactional" as const;

  constructor(private readonly currentCount: number) {
    super();
  }

  // Realtime is fired inline by the streaks service (`streak.completed`) for the
  // instant celebration; this job carries the durable channels.
  via(): ChannelName[] {
    return ["whatsapp", "database", "push"];
  }

  #title(): string {
    return `¡Completaste tu racha de ${this.currentCount} días! 🔥`;
  }

  #body(): string {
    return "Ganaste un premio. No olvides reclamarlo: mostrá tu código en la caja. 🧋";
  }

  toWhatsApp() {
    return { body: `${this.#title()}\n${this.#body()}` };
  }

  toPush() {
    return {
      title: this.#title(),
      body: "Ganaste un premio. ¡No olvides reclamarlo!",
      data: { kind: "streak-completed" },
    };
  }

  toDatabase() {
    return {
      type: "streak-completed",
      title: this.#title(),
      body: this.#body(),
      data: { currentCount: this.currentCount },
    };
  }
}

/** Streak reward claimed — transactional confirmation. */
export class StreakRewardClaimedNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "transactional" as const;

  // Realtime is fired inline by the streaks service (`streak.reward.claimed`).
  via(): ChannelName[] {
    return ["whatsapp", "database"];
  }

  toWhatsApp() {
    return {
      body: "¡Reclamaste el premio de tu racha! 🔥 Empezá una nueva hoy mismo.",
    };
  }

  toDatabase() {
    return {
      type: "streak-reward-claimed",
      title: "¡Premio de racha reclamado! 🔥",
      body: "Disfrutalo. Empezá una nueva racha hoy.",
    };
  }
}

/**
 * Streak at risk — the "you're about to lose your streak" nudge fired a few
 * hours before close. WhatsApp + in-app feed only.
 */
export class StreakAtRiskNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "transactional" as const;

  constructor(
    private readonly currentCount: number,
    private readonly hoursLeft: number,
  ) {
    super();
  }

  via(): ChannelName[] {
    return ["whatsapp", "database"];
  }

  #body(): string {
    const hrs =
      this.hoursLeft === 1 ? "queda 1 hora" : `quedan ${this.hoursLeft} horas`;
    return `Te ${hrs} para no perder tu racha de ${this.currentCount} días. ¡Pasá por tu T4! 🔥`;
  }

  toWhatsApp() {
    return { body: `¡No cortes la racha! 🔥\n${this.#body()}` };
  }

  toDatabase() {
    return {
      type: "streak-at-risk",
      title: "¡No cortes la racha! 🔥",
      body: this.#body(),
      data: { currentCount: this.currentCount, hoursLeft: this.hoursLeft },
    };
  }
}

/**
 * Consolidated per-purchase recap — one notification combining whatever loyalty
 * tracks are active (stamps and/or points), so the customer gets a single
 * WhatsApp + feed line instead of one per track. Realtime already animated each
 * card inline. Routine earn only — milestones (first purchase, tier-up) are
 * their own notifications.
 */
export class PurchaseRecapNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "transactional" as const;

  constructor(
    private readonly stamps: { completed: boolean } | null,
    private readonly points: { earned: number } | null,
  ) {
    super();
  }

  via(): ChannelName[] {
    return ["whatsapp", "database"];
  }

  #title(): string {
    if (this.stamps?.completed) return "¡Completaste tu tarjeta! 🎉";
    return "¡Gracias por tu compra! 🧋";
  }

  #parts(): string {
    const parts: string[] = [];
    if (this.stamps) parts.push(this.stamps.completed ? "tu bebida gratis te espera" : "+1 sello");
    if (this.points) parts.push(`+${this.points.earned} puntos`);
    return parts.join(" · ");
  }

  toWhatsApp() {
    return { body: `${this.#title()}\n${this.#parts()}` };
  }

  toDatabase() {
    return { type: "purchase-recap", title: this.#title(), body: this.#parts() };
  }
}

/** Full itemized receipt, resent on demand from the admin (WhatsApp + in-app).
 *  The enqueuer assembles the receipt; this class only renders it. */
export interface ReceiptPayload {
  items: { name: string; qty: number; unitAmountCents: number }[];
  subtotalCents: number | null;
  discountCents: number;
  totalCents: number;
  currency: string;
  stamps: number;
  points: number;
}

export class PurchaseReceiptNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "transactional" as const;

  constructor(private readonly receipt: ReceiptPayload) {
    super();
  }

  via(): ChannelName[] {
    return ["whatsapp", "database"];
  }

  #money(cents: number): string {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: this.receipt.currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  }

  #loyalty(): string {
    const parts: string[] = [];
    if (this.receipt.stamps > 0) {
      parts.push(`🧋 +${this.receipt.stamps} sello${this.receipt.stamps > 1 ? "s" : ""}`);
    }
    if (this.receipt.points > 0) parts.push(`+${this.receipt.points} puntos`);
    return parts.join(" · ");
  }

  toWhatsApp() {
    const r = this.receipt;
    const lines: string[] = ["🧾 Tu comprobante", ""];
    for (const it of r.items) {
      lines.push(`${it.qty}× ${it.name} — ${this.#money(it.unitAmountCents * it.qty)}`);
    }
    if (r.items.length > 0) lines.push("");
    if (r.subtotalCents != null) lines.push(`Subtotal: ${this.#money(r.subtotalCents)}`);
    if (r.discountCents > 0) lines.push(`Descuento: −${this.#money(r.discountCents)}`);
    lines.push(`Total: ${this.#money(r.totalCents)}`);
    const loyalty = this.#loyalty();
    if (loyalty) {
      lines.push("");
      lines.push(loyalty);
    }
    lines.push("", "¡Gracias por tu compra! 🧋");
    return { body: lines.join("\n") };
  }

  toDatabase() {
    const count = this.receipt.items.reduce((s, i) => s + i.qty, 0);
    const summary = count > 0 ? `${count} producto${count > 1 ? "s" : ""} · ` : "";
    return {
      type: "purchase-receipt",
      title: "Tu comprobante 🧾",
      body: `${summary}${this.#money(this.receipt.totalCents)}`,
      data: { ...this.receipt },
    };
  }
}

/** The customer is told their purchase was voided and what loyalty was undone. */
export class PurchaseVoidedNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "transactional" as const;

  constructor(private readonly reverted: { stamps: number; points: number }) {
    super();
  }

  via(): ChannelName[] {
    return ["whatsapp", "database"];
  }

  #parts(): string {
    const parts: string[] = [];
    if (this.reverted.stamps > 0) {
      parts.push(`−${this.reverted.stamps} sello${this.reverted.stamps > 1 ? "s" : ""}`);
    }
    if (this.reverted.points > 0) parts.push(`−${this.reverted.points} puntos`);
    return parts.join(" · ");
  }

  toWhatsApp() {
    const parts = this.#parts();
    return {
      body: parts
        ? `Tu compra fue anulada.\nSe revirtieron: ${parts}`
        : "Tu compra fue anulada.",
    };
  }

  toDatabase() {
    const parts = this.#parts();
    return {
      type: "purchase-voided",
      title: "Compra anulada",
      body: parts ? `Se revirtieron ${parts}` : "Tu compra fue anulada",
    };
  }
}

/** New tier reached — the big moment (benefits + T&C). */
export class TierUpNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "transactional" as const;

  constructor(
    private readonly tierName: string,
    private readonly benefits: string[],
    private readonly terms: string | null,
  ) {
    super();
  }

  via(): ChannelName[] {
    return ["whatsapp", "database", "push"];
  }

  #body(): string {
    const list = this.benefits.length
      ? ` Tus beneficios: ${this.benefits.join(", ")}.`
      : "";
    return `¡Felicidades! Ahora sos nivel ${this.tierName}.${list}`;
  }

  toWhatsApp() {
    const terms = this.terms ? `\n${this.terms}` : "";
    return { body: `${this.#body()}${terms}` };
  }

  toPush() {
    return {
      title: `¡Nuevo nivel: ${this.tierName}! 🎉`,
      body: "Tocá para ver tus beneficios.",
      data: { kind: "tier-up" },
    };
  }

  toDatabase() {
    return {
      type: "tier-up",
      title: `¡Nuevo nivel: ${this.tierName}! 🎉`,
      body: this.#body(),
      data: { benefits: this.benefits, terms: this.terms },
    };
  }
}

/** Tier dropped (points aged out of the window). */
export class TierDownNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "transactional" as const;

  constructor(private readonly tierName: string) {
    super();
  }

  via(): ChannelName[] {
    return ["whatsapp", "database"];
  }

  #body(): string {
    return `Bajaste a nivel ${this.tierName}. ¡Sumá puntos para recuperarlo!`;
  }

  toWhatsApp() {
    return { body: this.#body() };
  }

  toDatabase() {
    return { type: "tier-down", title: `Nivel ${this.tierName}`, body: this.#body() };
  }
}

/**
 * A reward just became claimable. Used two ways:
 *   - immediate unlock (the purchase flow can target all channels), or
 *   - a granular in-app feed row only (when `channelsOnly: "database"` so the
 *     combined recap owns WhatsApp/push and we never fan out N messages).
 */
export class RewardAvailableNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "transactional" as const;

  constructor(
    private readonly rewardName: string,
    private readonly databaseOnly = false,
  ) {
    super();
  }

  via(): ChannelName[] {
    return this.databaseOnly
      ? ["database"]
      : ["whatsapp", "database", "push", "realtime"];
  }

  #title(): string {
    return `¡Desbloqueaste un premio! 🎁`;
  }

  #body(): string {
    return `Ya podés canjear "${this.rewardName}". Mostrá tu código en la caja.`;
  }

  toWhatsApp() {
    return { body: `${this.#title()}\n${this.#body()}` };
  }

  toPush() {
    return {
      title: this.#title(),
      body: `Ya podés canjear "${this.rewardName}".`,
      data: { kind: "reward-available", rewardName: this.rewardName },
    };
  }

  toRealtime() {
    return {
      event: "notification",
      data: {
        type: "reward-available",
        title: this.#title(),
        body: this.#body(),
      },
    };
  }

  toDatabase() {
    return {
      type: "reward-available",
      title: this.#title(),
      body: this.#body(),
      data: { rewardName: this.rewardName },
    };
  }
}

/**
 * Combined post-purchase rewards recap — ONE WhatsApp + push summarizing every
 * reward that just became claimable (the granular per-reward feed rows are
 * written by `reward-available` database-only sends). Realtime is fired inline
 * by the rewards service (`rewards.unlocked`) for a single celebration.
 */
export class PurchaseRewardsRecapNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "transactional" as const;

  constructor(private readonly rewardNames: string[]) {
    super();
  }

  via(): ChannelName[] {
    return ["whatsapp", "push", "database"];
  }

  #title(): string {
    return this.rewardNames.length === 1
      ? "¡Desbloqueaste un premio! 🎁"
      : `¡Desbloqueaste ${this.rewardNames.length} premios! 🎁`;
  }

  #body(): string {
    const list = this.rewardNames.map((n) => `"${n}"`).join(", ");
    return `Ya podés canjear ${list}. Mostrá tu código en la caja.`;
  }

  toWhatsApp() {
    return { body: `${this.#title()}\n${this.#body()}` };
  }

  toPush() {
    return {
      title: this.#title(),
      body: this.#body(),
      data: { kind: "purchase-rewards-recap" },
    };
  }

  toDatabase() {
    return {
      type: "purchase-rewards-recap",
      title: this.#title(),
      body: this.#body(),
      data: { rewards: this.rewardNames },
    };
  }
}

/**
 * Reward reminder — "don't forget your unclaimed reward" nudge from the daily
 * cron, escalating through stages (d2/d7/d30). WhatsApp + in-app feed + push.
 */
export class RewardReminderNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "transactional" as const;

  constructor(private readonly rewardName: string) {
    super();
  }

  via(): ChannelName[] {
    return ["whatsapp", "database", "push"];
  }

  #body(): string {
    return `Todavía tenés "${this.rewardName}" sin reclamar. ¡Pasá por tu T4 y disfrutalo! 🧋`;
  }

  toWhatsApp() {
    return { body: `¡Tu premio te espera! 🎁\n${this.#body()}` };
  }

  toPush() {
    return {
      title: "¡Tu premio te espera! 🎁",
      body: `Reclamá "${this.rewardName}".`,
      data: { kind: "reward-reminder", rewardName: this.rewardName },
    };
  }

  toDatabase() {
    return {
      type: "reward-reminder",
      title: "¡Tu premio te espera! 🎁",
      body: this.#body(),
      data: { rewardName: this.rewardName },
    };
  }
}

/** Almost at the next tier. */
export class TierNearNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "transactional" as const;

  constructor(
    private readonly nextName: string,
    private readonly remaining: number,
  ) {
    super();
  }

  via(): ChannelName[] {
    return ["whatsapp", "database"];
  }

  #body(): string {
    return `Te faltan ${this.remaining} puntos para nivel ${this.nextName}. 💪`;
  }

  toWhatsApp() {
    return { body: this.#body() };
  }

  toDatabase() {
    return { type: "tier-near", title: "¡Estás cerca!", body: this.#body() };
  }
}

/**
 * Promotional campaign — marketing (respects opt-out). Built by the
 * `send-campaign` job with content ALREADY rendered for the single channel the
 * reachability resolver picked (so `via()` returns exactly that channel and the
 * matching `toX()` supplies the pre-rendered copy). See the campaigns feature.
 */
export class CampaignNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "marketing" as const;

  constructor(
    private readonly channel: ChannelName,
    private readonly content: {
      push?: { title: string; body: string; clickAction?: string };
      mail?: { subject: string; html: string };
      sms?: { body: string };
      whatsapp?: { body: string };
    },
  ) {
    super();
  }

  via(): ChannelName[] {
    return [this.channel];
  }

  toPush() {
    return this.content.push ?? { title: "", body: "" };
  }

  toMail() {
    return this.content.mail ?? { subject: "", html: "" };
  }

  toSms() {
    return this.content.sms ?? { body: "" };
  }

  toWhatsApp() {
    return this.content.whatsapp ?? { body: "" };
  }
}

/**
 * Security alert when a customer changes their phone. Transactional (always
 * sends). WhatsApp is dispatched with an explicit recipient override (the OLD
 * contact) so it reaches the previous number even though the `customer` row
 * already holds the new one; the database (in-app feed) entry is keyed to the
 * account. No SMS / mail.
 */
export class PhoneChangedNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "transactional" as const;

  constructor(private readonly newPhoneMasked: string) {
    super();
  }

  via(): ChannelName[] {
    return ["whatsapp", "database"];
  }

  #body(): string {
    return `Cambiaste el número de tu cuenta T4 Diver Club a ${this.newPhoneMasked}. Si no fuiste vos, contactá a la tienda de inmediato.`;
  }

  toWhatsApp() {
    return { body: this.#body() };
  }

  toDatabase() {
    return {
      type: "phone-changed",
      title: "Cambiaste tu número",
      body: this.#body(),
    };
  }
}


/**
 * Org loyalty-mode change ("points paused/resumed", "stamps paused/resumed").
 * Transactional — it affects the customer's balances, so the marketing opt-out
 * does not apply. Feed + push only (no WhatsApp: operational notice, not worth
 * per-message spend). Title/body are computed by the announce-loyalty-mode job.
 */
export class LoyaltyModeNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "transactional" as const;

  constructor(
    private readonly title: string,
    private readonly body: string,
  ) {
    super();
  }

  via(): ChannelName[] {
    return ["push", "database"];
  }

  toPush() {
    return { title: this.title, body: this.body };
  }

  toDatabase() {
    return { type: "loyalty-mode", title: this.title, body: this.body };
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
      const stampsGoal =
        typeof payload?.stampsGoal === "number" ? payload.stampsGoal : 9;
      const completed = payload?.completed === true;
      return new StampEarnedNotification(currentStamps, stampsGoal, completed);
    }
    case "reward-claimed": {
      const rewardName =
        typeof payload?.rewardName === "string" ? payload.rewardName : null;
      return new RewardClaimedNotification(rewardName);
    }
    case "reward-claim-code": {
      const rewardName =
        typeof payload?.rewardName === "string" ? payload.rewardName : "tu premio";
      const code = typeof payload?.code === "string" ? payload.code : "";
      return new RewardClaimCodeNotification(rewardName, code);
    }
    case "reward-available": {
      const rewardName =
        typeof payload?.rewardName === "string" ? payload.rewardName : "";
      const databaseOnly = payload?.channelsOnly === "database";
      return new RewardAvailableNotification(rewardName, databaseOnly);
    }
    case "purchase-rewards-recap": {
      const rewards = Array.isArray(payload?.rewards)
        ? (payload.rewards as unknown[])
            .map((r) =>
              r && typeof r === "object" && "name" in r
                ? String((r as { name: unknown }).name)
                : null,
            )
            .filter((n): n is string => n !== null)
        : [];
      return new PurchaseRewardsRecapNotification(rewards);
    }
    case "reward-reminder": {
      const rewardName =
        typeof payload?.rewardName === "string" ? payload.rewardName : "";
      return new RewardReminderNotification(rewardName);
    }
    case "streak-completed": {
      const currentCount =
        typeof payload?.currentCount === "number" ? payload.currentCount : 0;
      return new StreakCompletedNotification(currentCount);
    }
    case "streak-reward-claimed":
      return new StreakRewardClaimedNotification();
    case "streak-at-risk": {
      const currentCount =
        typeof payload?.currentCount === "number" ? payload.currentCount : 0;
      const hoursLeft =
        typeof payload?.hoursLeft === "number" ? payload.hoursLeft : 0;
      return new StreakAtRiskNotification(currentCount, hoursLeft);
    }
    case "purchase-recap": {
      const s = payload?.stamps as { completed?: boolean } | null | undefined;
      const p = payload?.points as { earned?: number } | null | undefined;
      return new PurchaseRecapNotification(
        s ? { completed: s.completed === true } : null,
        p && typeof p.earned === "number" ? { earned: p.earned } : null,
      );
    }
    case "purchase-receipt": {
      const r = (payload ?? {}) as Record<string, unknown>;
      const items = Array.isArray(r.items)
        ? (r.items as unknown[]).map((raw) => {
            const o = raw as Record<string, unknown>;
            return {
              name: typeof o.name === "string" ? o.name : "—",
              qty: typeof o.qty === "number" ? o.qty : 1,
              unitAmountCents: typeof o.unitAmountCents === "number" ? o.unitAmountCents : 0,
            };
          })
        : [];
      return new PurchaseReceiptNotification({
        items,
        subtotalCents: typeof r.subtotalCents === "number" ? r.subtotalCents : null,
        discountCents: typeof r.discountCents === "number" ? r.discountCents : 0,
        totalCents: typeof r.totalCents === "number" ? r.totalCents : 0,
        currency: typeof r.currency === "string" ? r.currency : "COP",
        stamps: typeof r.stamps === "number" ? r.stamps : 0,
        points: typeof r.points === "number" ? r.points : 0,
      });
    }
    case "purchase-voided": {
      const r = (payload ?? {}) as Record<string, unknown>;
      return new PurchaseVoidedNotification({
        stamps: typeof r.stamps === "number" ? r.stamps : 0,
        points: typeof r.points === "number" ? r.points : 0,
      });
    }
    case "tier-up": {
      const tierName =
        typeof payload?.tierName === "string" ? payload.tierName : "";
      const benefits = Array.isArray(payload?.benefits)
        ? (payload.benefits as unknown[]).filter(
            (b): b is string => typeof b === "string",
          )
        : [];
      const terms = typeof payload?.terms === "string" ? payload.terms : null;
      return new TierUpNotification(tierName, benefits, terms);
    }
    case "tier-down": {
      const tierName =
        typeof payload?.tierName === "string" ? payload.tierName : "";
      return new TierDownNotification(tierName);
    }
    case "tier-near": {
      const nextName =
        typeof payload?.nextName === "string" ? payload.nextName : "";
      const remaining =
        typeof payload?.remaining === "number" ? payload.remaining : 0;
      return new TierNearNotification(nextName, remaining);
    }
    case "phone-changed": {
      const masked =
        typeof payload?.newPhoneMasked === "string"
          ? payload.newPhoneMasked
          : "";
      return new PhoneChangedNotification(masked);
    }
    case "loyalty-mode": {
      const title = typeof payload?.title === "string" ? payload.title : "";
      const body = typeof payload?.body === "string" ? payload.body : "";
      return new LoyaltyModeNotification(title, body);
    }
  }
}
