import { tasks } from "@trigger.dev/sdk/v3";
import { TRPCError } from "@trpc/server";

import type { RealtimeBinding } from "../../trpc";
import { signClaimToken, verifyClaimToken } from "./claim-token";
import type { StampsRepository } from "./repository";
import type {
  CompletedWalletItem,
  HistoryInput,
  PurchaseHistoryItem,
  RecordPurchaseInput,
  WalletView,
} from "./schemas";

type NotificationKey = "stamp-earned" | "reward-claimed" | "first-purchase";

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
  /** HS256 secret for claim tokens (`REALTIME_AUTH_SECRET`). */
  signSecret: string;
  /** Override the notification enqueue (tests inject a fake). */
  enqueue?: Enqueue;
}

/**
 * Stamps business logic: record a purchase (→ stamp → wallet bump → completion),
 * read the customer's wallet / history / completed wallets, and the reward claim
 * (issue the signed QR token + confirm the scan). Side effects are best-effort:
 * realtime fires inline (instant card animation); WhatsApp + in-app go through
 * the Trigger.dev `send-notification` job. Neither failure rolls back the write.
 */
export class StampsService {
  constructor(
    private readonly repo: StampsRepository,
    private readonly opts: StampsServiceOptions,
  ) {}

  async recordPurchase(
    organizationId: string,
    addedByUserId: string,
    // The router resolves net price + discount server-side for itemized sales.
    input: RecordPurchaseInput & { subtotalCents?: number; discountCents?: number },
  ): Promise<{ wallet: WalletView; purchaseId: string }> {
    const result = await this.repo.recordPurchase({
      orgId: organizationId,
      customerId: input.customerId,
      addedByUserId,
      priceCents: input.priceCents,
      idempotencyKey: input.idempotencyKey,
      subtotalCents: input.subtotalCents,
      discountCents: input.discountCents,
      currency: input.currency,
      appliedPromoId: input.appliedPromoId ?? null,
      items: input.items,
    });

    if (result.kind === "reward_pending") {
      throw new TRPCError({ code: "CONFLICT", message: "REWARD_PENDING" });
    }

    if (result.kind === "recorded") {
      // Realtime fires inline so the stamp card animates instantly.
      await this.publish(input.customerId, {
        event: "stamp.earned",
        data: {
          walletId: result.wallet.id,
          currentStamps: result.wallet.currentStamps,
          walletSize: result.wallet.walletSize,
          stampsGoal: result.wallet.stampsGoal,
          completed: result.completed,
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
  ): Promise<WalletView> {
    return this.repo.walletView(organizationId, customerId);
  }

  myWallet(organizationId: string, customerId: string): Promise<WalletView> {
    return this.repo.walletView(organizationId, customerId);
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

  myCompletedWallets(
    organizationId: string,
    customerId: string,
  ): Promise<CompletedWalletItem[]> {
    return this.repo.completedWallets(organizationId, customerId);
  }

  async issueClaimToken(
    organizationId: string,
    customerId: string,
  ): Promise<{ token: string; expiresAt: string; walletId: string }> {
    const pending = await this.repo.pendingWallet(organizationId, customerId);
    if (!pending) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "NO_REWARD_PENDING",
      });
    }
    const { token, expiresAt } = await signClaimToken({
      customerId,
      walletId: pending.id,
      secret: this.opts.signSecret,
    });
    return { token, expiresAt, walletId: pending.id };
  }

  async claim(
    organizationId: string,
    claimedByUserId: string,
    token: string,
  ): Promise<{ ok: true; newWallet: WalletView }> {
    let parsed: { customerId: string; walletId: string };
    try {
      parsed = await verifyClaimToken(token, this.opts.signSecret);
    } catch {
      throw new TRPCError({ code: "BAD_REQUEST", message: "INVALID_TOKEN" });
    }

    const result = await this.repo.claimWallet({
      orgId: organizationId,
      walletId: parsed.walletId,
      customerId: parsed.customerId,
      claimedByUserId,
    });
    if (result.kind === "not_pending") {
      throw new TRPCError({ code: "CONFLICT", message: "ALREADY_CLAIMED" });
    }

    await this.publish(parsed.customerId, {
      event: "reward.claimed",
      data: { walletId: result.walletId },
    });
    await this.enqueue({
      customerIds: [parsed.customerId],
      organizationId,
      notificationKey: "reward-claimed",
      payload: { walletId: result.walletId },
    });

    return { ok: true, newWallet: result.newWallet };
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
