import { tasks } from "@trigger.dev/sdk/v3";
import { TRPCError } from "@trpc/server";

import type { RealtimeBinding } from "../../trpc";
import { signStreakClaimToken, verifyStreakClaimToken } from "./claim-token";
import type { StreaksRepository } from "./repository";
import type { StreakHistoryItem, StreakView } from "./schemas";
import { localDay } from "./streak-calendar";

type NotificationKey = "streak-completed" | "streak-reward-claimed" | "streak-at-risk";

type EnqueuePayload = {
  customerIds: string[];
  organizationId: string;
  notificationKey: NotificationKey;
  payload?: Record<string, unknown>;
};

export type Enqueue = (payload: EnqueuePayload) => Promise<void>;

// Untyped trigger by id (same reason as stamps): typing the payload would create
// an @loyalty/api → @loyalty/jobs cycle.
const defaultEnqueue: Enqueue = async (payload) => {
  await tasks.trigger("send-notification", payload);
};

export interface StreaksServiceOptions {
  realtime?: RealtimeBinding;
  /** HS256 secret for claim tokens (`REALTIME_AUTH_SECRET`). */
  signSecret: string;
  enqueue?: Enqueue;
}

/**
 * Streak business logic: advance the streak when a purchase is recorded (→
 * realtime card animation; completion fires WhatsApp + in-app + push), read the
 * customer's streak, and the reward claim (signed QR + cashier scan). Realtime
 * fires inline; durable channels go through the Trigger.dev `send-notification`
 * job. Side effects are best-effort and never roll back the purchase.
 */
export class StreaksService {
  constructor(
    private readonly repo: StreaksRepository,
    private readonly opts: StreaksServiceOptions,
  ) {}

  /** Called right after a purchase is recorded (stamps flow). Idempotent per
   *  day. Publishes `streak.advanced`, and on completion `streak.completed` +
   *  the streak-completed notification. */
  async advanceForPurchase(
    organizationId: string,
    customerId: string,
    at: Date = new Date(),
  ): Promise<void> {
    const day = localDay(at);
    const result = await this.repo.advanceForPurchase({
      orgId: organizationId,
      customerId,
      day,
    });
    if (!result.changed) return;

    await this.publish(customerId, {
      event: result.completed ? "streak.completed" : "streak.advanced",
      data: { currentCount: result.currentCount },
    });

    if (result.completed) {
      await this.enqueue({
        customerIds: [customerId],
        organizationId,
        notificationKey: "streak-completed",
        payload: { currentCount: result.currentCount },
      });
    }
  }

  myStreak(organizationId: string, customerId: string): Promise<StreakView> {
    return this.repo.view(organizationId, customerId);
  }

  streakForCustomer(
    organizationId: string,
    customerId: string,
  ): Promise<StreakView> {
    return this.repo.view(organizationId, customerId);
  }

  myHistory(
    organizationId: string,
    customerId: string,
  ): Promise<StreakHistoryItem[]> {
    return this.repo.history(organizationId, customerId);
  }

  async issueClaimToken(
    organizationId: string,
    customerId: string,
  ): Promise<{ token: string; expiresAt: string; streakId: string }> {
    const pending = await this.repo.pendingReward(organizationId, customerId);
    if (!pending) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "NO_REWARD_PENDING",
      });
    }
    const { token, expiresAt } = await signStreakClaimToken({
      customerId,
      streakId: pending.id,
      secret: this.opts.signSecret,
    });
    return { token, expiresAt, streakId: pending.id };
  }

  async claimReward(
    organizationId: string,
    claimedByUserId: string,
    token: string,
  ): Promise<{ ok: true }> {
    let parsed: { customerId: string; streakId: string };
    try {
      parsed = await verifyStreakClaimToken(token, this.opts.signSecret);
    } catch {
      throw new TRPCError({ code: "BAD_REQUEST", message: "INVALID_TOKEN" });
    }

    const result = await this.repo.claimStreak({
      orgId: organizationId,
      streakId: parsed.streakId,
      customerId: parsed.customerId,
      claimedByUserId,
    });
    if (result.kind === "not_pending") {
      throw new TRPCError({ code: "CONFLICT", message: "ALREADY_CLAIMED" });
    }

    await this.publish(parsed.customerId, {
      event: "streak.reward.claimed",
      data: { streakId: parsed.streakId },
    });
    await this.enqueue({
      customerIds: [parsed.customerId],
      organizationId,
      notificationKey: "streak-reward-claimed",
      payload: { streakId: parsed.streakId },
    });

    return { ok: true };
  }

  private async publish(
    customerId: string,
    event: { event: string; data: Record<string, unknown> },
  ): Promise<void> {
    if (!this.opts.realtime) return;
    await this.opts.realtime.publish(`customer:${customerId}`, event).catch(() => {
      // best-effort: never fail the write because realtime was unreachable.
    });
  }

  private async enqueue(payload: EnqueuePayload): Promise<void> {
    const fn = this.opts.enqueue ?? defaultEnqueue;
    try {
      await fn(payload);
    } catch {
      // best-effort: realtime + the customer reopening the app cover the gap.
    }
  }
}
