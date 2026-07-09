import { recordAudit } from "@loyalty/db";
import { tasks } from "@trigger.dev/sdk/v3";
import { TRPCError } from "@trpc/server";

import type { RealtimeBinding } from "../../trpc";
import {
  EARN_PER,
  EARN_POINTS,
  POINTS_ENABLED,
  WINDOW_DAYS,
} from "./config";
import type { PointsRepository } from "./repository";
import type {
  HistoryInput,
  PointsHistoryItem,
  PointsSummary,
  PointsTransactionsView,
  TransactionsInput,
} from "./schemas";
import { tierFor, tierRank } from "./tier-calc";

type NotificationKey = "tier-up" | "tier-down" | "tier-near";

type EnqueuePayload = {
  customerIds: string[];
  organizationId: string;
  notificationKey: NotificationKey;
  payload?: Record<string, unknown>;
};

export type Enqueue = (payload: EnqueuePayload) => Promise<void>;

const defaultEnqueue: Enqueue = async (payload) => {
  await tasks.trigger("send-notification", payload);
};

export interface PointsServiceOptions {
  realtime?: RealtimeBinding;
  enqueue?: Enqueue;
}

const DAY_MS = 86_400_000;

/** Points for a purchase price: `floor((priceCents/100) / EARN_PER) * EARN_POINTS`. */
export function pointsForPrice(priceCents: number): number {
  const major = Math.floor(priceCents / 100);
  return Math.floor(major / EARN_PER) * EARN_POINTS;
}

/**
 * Points business logic: earn on purchase, recompute the tier from the rolling
 * window, and fire tier transition / near-threshold notifications. Balance +
 * tier-points are derived from the ledger; the cached `points_account` lets us
 * detect up/down moves. Realtime fires inline; durable channels go through the
 * Trigger.dev job. Side effects are best-effort.
 */
export class PointsService {
  constructor(
    private readonly repo: PointsRepository,
    private readonly opts: PointsServiceOptions = {},
  ) {}

  /** Called after a purchase records. Idempotent per purchaseId. Returns the
   *  points earned (0 if disabled / dup / below the rate floor) + new balance. */
  async earnForPurchase(
    organizationId: string,
    customerId: string,
    priceCents: number,
    purchaseId: string,
    storeId: string,
    opts: { multiplier?: number } = {},
  ): Promise<{
    earned: number;
    balance: number;
    tierUp?: { tierName: string } | null;
  }> {
    if (!POINTS_ENABLED) {
      return { earned: 0, balance: await this.repo.balance(organizationId, customerId) };
    }
    const points = Math.round(pointsForPrice(priceCents) * (opts.multiplier ?? 1));
    if (points <= 0) {
      return { earned: 0, balance: await this.repo.balance(organizationId, customerId) };
    }

    const inserted = await this.repo.earn({
      orgId: organizationId,
      customerId,
      purchaseId,
      storeId,
      points,
    });
    const balance = await this.repo.balance(organizationId, customerId);
    if (!inserted) return { earned: 0, balance }; // idempotent retry

    await this.publish(customerId, {
      event: "points.earned",
      data: { earned: points, balance },
    });
    const tierUp = await this.recompute(organizationId, customerId);
    return { earned: points, balance, tierUp };
  }

  /** Recompute the tier from the window; fire up/down + near-threshold side
   *  effects. Shared by earn (instant up) and the cron (time-based down).
   *  Returns the tier name when the customer moved UP (so the purchase
   *  orchestration can fold it into the single rewards-unlock celebration). */
  async recompute(
    organizationId: string,
    customerId: string,
    opts: { silent?: boolean } = {},
  ): Promise<{ tierName: string } | null> {
    const windowStart = new Date(Date.now() - WINDOW_DAYS * DAY_MS);
    const tierPoints = await this.repo.tierPoints(
      organizationId,
      customerId,
      windowStart,
    );
    const view = tierFor(tierPoints);
    const account = await this.repo.account(organizationId, customerId);

    const oldKey = account?.currentTierKey ?? null;
    const newKey = view.current.key;
    const oldRank = oldKey ? tierRank(oldKey) : 0;
    const newRank = tierRank(newKey);
    let nearKey = account?.nearNotifiedTierKey ?? null;

    const tierChanged = newKey !== oldKey;
    let tierUp: { tierName: string } | null = null;
    // First-ever assignment to the base tier is silent — just create the account.
    const isInitialBase = oldKey === null && newRank === 0;
    if (tierChanged && !isInitialBase) {
      nearKey = null; // a new tier resets the "almost there" dedupe
      if (newRank > oldRank) {
        tierUp = { tierName: view.current.name };
        if (!opts.silent) {
          await this.publish(customerId, {
            event: "tier.changed",
            data: {
              direction: "up",
              tier: {
                key: newKey,
                name: view.current.name,
                color: view.current.color,
                icon: view.current.icon,
                benefits: view.current.benefits.map((b) => b.label),
                terms: view.current.terms ?? null,
              },
            },
          });
          await this.enqueue({
            customerIds: [customerId],
            organizationId,
            notificationKey: "tier-up",
            payload: {
              tierName: view.current.name,
              benefits: view.current.benefits.map((b) => b.label),
              terms: view.current.terms ?? null,
            },
          });
        }
      } else if (!opts.silent) {
        await this.publish(customerId, {
          event: "tier.changed",
          data: { direction: "down", tier: { key: newKey, name: view.current.name } },
        });
        await this.enqueue({
          customerIds: [customerId],
          organizationId,
          notificationKey: "tier-down",
          payload: { tierName: view.current.name },
        });
      }
    }

    if (view.nearNext && view.next && nearKey !== view.next.key) {
      if (!opts.silent) {
        await this.enqueue({
          customerIds: [customerId],
          organizationId,
          notificationKey: "tier-near",
          payload: { nextName: view.next.name, remaining: view.remainingToNext },
        });
      }
      nearKey = view.next.key;
    }

    if (!account || tierChanged || nearKey !== (account.nearNotifiedTierKey ?? null)) {
      await this.repo.saveAccount({
        orgId: organizationId,
        customerId,
        currentTierKey: newKey,
        nearNotifiedTierKey: nearKey,
      });
    }

    return tierUp;
  }

  /** Apply a signed manual adjustment (correction / void reversal): write the
   *  `adjust` ledger row, then recompute the tier. Returns the new balance.
   *  Note: `adjust` rows don't count toward tier-points (only `earn` does), so
   *  the recompute only reflects window aging — the balance changes, the tier
   *  qualification doesn't. */
  async adjust(
    organizationId: string,
    customerId: string,
    points: number,
    reason: string,
    opts: { purchaseId?: string; storeId?: string | null; addedByUserId?: string } = {},
  ): Promise<{ balance: number }> {
    await this.repo.adjust({
      orgId: organizationId,
      customerId,
      points,
      reason,
      purchaseId: opts.purchaseId ?? null,
      storeId: opts.storeId ?? null,
      addedByUserId: opts.addedByUserId ?? null,
    });
    const balance = await this.repo.balance(organizationId, customerId);
    await this.publish(customerId, { event: "points.adjusted", data: { points, balance } });
    await this.recompute(organizationId, customerId);
    return { balance };
  }

  /** Owner correction tied to a purchase (surfaces in the purchase timeline). */
  async adjustForPurchase(
    organizationId: string,
    purchaseId: string,
    points: number,
    reason: string,
    addedByUserId: string,
  ): Promise<{ balance: number }> {
    const ref = await this.repo.purchaseRef(organizationId, purchaseId);
    if (!ref) {
      throw new TRPCError({ code: "NOT_FOUND", message: "PURCHASE_NOT_FOUND" });
    }
    return this.adjust(organizationId, ref.customerId, points, reason, {
      purchaseId,
      storeId: ref.storeId,
      addedByUserId,
    });
  }

  /** Owner correction of a customer's points not tied to a purchase (CRM). */
  async adjustForCustomer(
    organizationId: string,
    customerId: string,
    points: number,
    reason: string,
    addedByUserId: string,
  ): Promise<{ balance: number }> {
    const res = await this.adjust(organizationId, customerId, points, reason, { addedByUserId });
    await recordAudit({
      organizationId,
      actorUserId: addedByUserId,
      targetUserId: customerId,
      type: "customer_points_adjust",
      metadata: { points, reason },
    });
    return res;
  }

  async mySummary(
    organizationId: string,
    customerId: string,
  ): Promise<PointsSummary> {
    const windowStart = new Date(Date.now() - WINDOW_DAYS * DAY_MS);
    const [balance, tierPoints] = await Promise.all([
      this.repo.balance(organizationId, customerId),
      this.repo.tierPoints(organizationId, customerId, windowStart),
    ]);
    const view = tierFor(tierPoints);
    return {
      balance,
      tierPoints,
      windowDays: WINDOW_DAYS,
      current: view.current,
      next: view.next,
      progress: view.progress,
      remainingToNext: view.remainingToNext,
      nearNext: view.nearNext,
    };
  }

  summaryForCustomer(
    organizationId: string,
    customerId: string,
  ): Promise<PointsSummary> {
    return this.mySummary(organizationId, customerId);
  }

  myHistory(
    organizationId: string,
    customerId: string,
    input: HistoryInput,
  ): Promise<{ rows: PointsHistoryItem[]; total: number }> {
    return this.repo.history(organizationId, customerId, input.page, input.pageSize);
  }

  /** Cursor-paginated, UI-friendly ledger for the dedicated transactions view
   *  (date-range + infinite scroll). The repo resolves `kind` + `rewardName`. */
  myTransactions(
    organizationId: string,
    customerId: string,
    input: TransactionsInput,
  ): Promise<PointsTransactionsView> {
    return this.repo.transactions(organizationId, customerId, {
      from: input.from ? new Date(input.from) : undefined,
      to: input.to ? new Date(input.to) : undefined,
      cursor: input.cursor,
      limit: input.limit,
    });
  }

  private async publish(
    customerId: string,
    event: { event: string; data: Record<string, unknown> },
  ): Promise<void> {
    if (!this.opts.realtime) return;
    await this.opts.realtime.publish(`customer:${customerId}`, event).catch(() => {
      // best-effort
    });
  }

  private async enqueue(payload: EnqueuePayload): Promise<void> {
    const fn = this.opts.enqueue ?? defaultEnqueue;
    try {
      await fn(payload);
    } catch {
      // best-effort
    }
  }
}
