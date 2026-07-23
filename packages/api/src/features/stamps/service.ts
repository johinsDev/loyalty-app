import { recordAudit } from "@loyalty/db";
import { tasks } from "@trigger.dev/sdk/v3";

import type { RealtimeBinding } from "../../trpc";
import type { StampsRepository } from "./repository";
import type {
  HistoryInput,
  PurchaseHistoryItem,
  RecordPurchaseInput,
  StampsAccrual,
  WalletView,
} from "./schemas";

type NotificationKey = "first-purchase";

type EnqueuePayload = {
  customerIds: string[];
  organizationId: string;
  notificationKey: NotificationKey;
  payload?: Record<string, unknown>;
};

export type Enqueue = (payload: EnqueuePayload) => Promise<void>;

// Untyped trigger by id — same reason as NotificationService: typing the payload
// would create an @loyalty/api → @loyalty/jobs cycle. Shape mirrors
// packages/jobs/trigger/send-notification.ts.
const defaultEnqueue: Enqueue = async (payload) => {
  await tasks.trigger("send-notification", payload);
};

export interface StampsServiceOptions {
  /** Bound by the router from `ctx.realtime` (FakeRealtime in dev/preview). */
  realtime?: RealtimeBinding;
  /** Override the notification enqueue (tests inject a fake). */
  enqueue?: Enqueue;
}

/**
 * Stamps business logic: record a purchase (→ stamp → spendable-balance bump),
 * and read the customer's wallet / history. The card is a perpetual spendable
 * balance — it never completes and never blocks a purchase (the free drink is a
 * rewards-catalog reward claimed via the rewards feature). Side effects are
 * best-effort: realtime fires inline (instant card animation); the first-purchase
 * notification goes through the Trigger.dev `send-notification` job. Neither
 * failure rolls back the write.
 */
export class StampsService {
  constructor(
    private readonly repo: StampsRepository,
    private readonly opts: StampsServiceOptions,
  ) {}

  async recordPurchase(
    organizationId: string,
    addedByUserId: string,
    // The store the sale happened at (resolved from the register store-switcher).
    storeId: string,
    // The router resolves net price + discount + attribution server-side.
    input: RecordPurchaseInput & {
      subtotalCents?: number;
      discountCents?: number;
      promoDiscountCents?: number;
      rewardDiscountCents?: number;
      stampEligible: boolean;
      acc: StampsAccrual;
      entrySource?: string | null;
      metadata?: Record<string, unknown> | null;
    },
  ): Promise<{ wallet: WalletView; purchaseId: string }> {
    const result = await this.repo.recordPurchase({
      orgId: organizationId,
      customerId: input.customerId,
      addedByUserId,
      storeId,
      priceCents: input.priceCents,
      idempotencyKey: input.idempotencyKey,
      subtotalCents: input.subtotalCents,
      discountCents: input.discountCents,
      promoDiscountCents: input.promoDiscountCents,
      rewardDiscountCents: input.rewardDiscountCents,
      stampEligible: input.stampEligible,
      acc: input.acc,
      currency: input.currency,
      appliedPromoId: input.appliedPromoId ?? null,
      entrySource: input.entrySource ?? null,
      metadata: input.metadata ?? null,
      orderNote: input.orderNote ?? null,
      items: input.items,
      inlineReward: input.inlineReward
        ? {
            rewardId: input.inlineReward.rewardId,
            currency: input.inlineReward.currency,
            redeemedByUserId: addedByUserId,
          }
        : undefined,
    });

    if (result.kind === "recorded") {
      // Realtime fires inline so the stamp card animates instantly.
      await this.publish(input.customerId, {
        event: "stamp.earned",
        data: {
          walletId: result.wallet.id,
          currentStamps: result.wallet.currentStamps,
          walletSize: result.wallet.walletSize,
          stampsGoal: result.wallet.stampsGoal,
        },
      });

      // The very first stamp ever → celebratory first-purchase (feed + realtime
      // + push, no WhatsApp). The routine "+1 sello" message is consolidated with
      // points into the per-purchase recap (enqueued by the recordPurchase
      // orchestration in the router), so we don't enqueue stamp-earned here.
      const firstEver =
        result.wallet.sequence === 1 && result.wallet.currentStamps === 1;
      if (firstEver) {
        await this.enqueue({
          customerIds: [input.customerId],
          organizationId,
          notificationKey: "first-purchase",
          payload: {
            currentStamps: result.wallet.currentStamps,
            stampsGoal: result.wallet.stampsGoal,
          },
        });
      }
    }

    return { wallet: result.wallet, purchaseId: result.purchaseId };
  }

  walletForCustomer(
    organizationId: string,
    customerId: string,
    acc: StampsAccrual,
  ): Promise<WalletView> {
    return this.repo.walletView(organizationId, customerId, acc);
  }

  myWallet(
    organizationId: string,
    customerId: string,
    acc: StampsAccrual,
  ): Promise<WalletView> {
    return this.repo.walletView(organizationId, customerId, acc);
  }

  myHistory(
    organizationId: string,
    customerId: string,
    input: HistoryInput,
  ): Promise<{ rows: PurchaseHistoryItem[]; total: number }> {
    return this.repo.history(
      organizationId,
      customerId,
      input.page,
      input.pageSize,
    );
  }

  /** Owner CRM correction of a customer's stamps (no purchase). Signed delta,
   *  clamped ≥0; audited; fires the realtime card animation. */
  async adjustForCustomer(
    organizationId: string,
    customerId: string,
    delta: number,
    reason: string,
    addedByUserId: string,
    acc: StampsAccrual,
  ): Promise<{ wallet: WalletView }> {
    const wallet = await this.repo.adjustStamps({
      orgId: organizationId,
      customerId,
      delta,
      note: reason,
      addedByUserId,
      acc,
    });
    await recordAudit({
      organizationId,
      actorUserId: addedByUserId,
      targetUserId: customerId,
      type: "customer_stamps_adjust",
      metadata: { delta, reason },
    });
    if (wallet.id) {
      await this.publish(customerId, {
        event: "stamp.earned",
        data: {
          walletId: wallet.id,
          currentStamps: wallet.currentStamps,
          walletSize: wallet.walletSize,
          stampsGoal: wallet.stampsGoal,
        },
      });
    }
    return { wallet };
  }

  private async publish(
    customerId: string,
    event: { event: string; data: Record<string, unknown> },
  ): Promise<void> {
    if (!this.opts.realtime) return;
    await this.opts.realtime
      .publish(`customer:${customerId}`, event)
      .catch(() => {
        // best-effort: never fail the write because realtime was unreachable.
      });
  }

  private async enqueue(payload: EnqueuePayload): Promise<void> {
    const fn = this.opts.enqueue ?? defaultEnqueue;
    try {
      await fn(payload);
    } catch {
      // best-effort: the realtime event + the customer reopening the app cover
      // the gap if the durable channels failed to enqueue.
    }
  }
}
