import { tasks } from "@trigger.dev/sdk/v3";
import { TRPCError } from "@trpc/server";

import {
  activeClaimKey,
  cancelPendingClaim,
  claimCodeExpiresAt,
  CLAIM_CODE_TTL_SECONDS,
  clearActiveClaim,
  generateClaimCode,
  type PendingClaim,
  pendingClaimKey,
  requireCache,
  verifyPendingClaim,
} from "../_shared/claim-code";
import type { CacheBinding, RealtimeBinding } from "../../trpc";
import { signStreakClaimToken, verifyStreakClaimToken } from "./claim-token";
import type { StreaksRepository } from "./repository";
import type {
  RequestClaimResult,
  StreakHistoryItem,
  StreakView,
} from "./schemas";
import { localDay } from "./streak-calendar";

/** Label for the streak reward in the OTP realtime/notification payload. */
const STREAK_REWARD_NAME = "Premio de racha";

type NotificationKey =
  | "streak-completed"
  | "streak-reward-claimed"
  | "streak-at-risk"
  | "reward-claim-code";

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
  /** Cache for the code-based claim OTP (optional → no caching in tests). */
  cache?: CacheBinding;
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

    return this.runStreakClaim(
      organizationId,
      parsed.customerId,
      parsed.streakId,
      claimedByUserId,
    );
  }

  /**
   * Cashier-initiated, code-based claim of the pending streak reward (the "no
   * scanner" path). Validates a reward is pending (NO_REWARD_PENDING — mirrors
   * `issueClaimToken`), then mints a 6-digit code held in the cache (bound to
   * the staff member). The code is delivered out-of-band, never over HTTP.
   */
  async requestClaim(
    organizationId: string,
    staffId: string,
    customerId: string,
  ): Promise<RequestClaimResult> {
    const cache = requireCache(this.opts.cache);

    const pending = await this.repo.pendingReward(organizationId, customerId);
    if (!pending) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "NO_REWARD_PENDING",
      });
    }

    const pendingId = crypto.randomUUID();
    const code = generateClaimCode();
    const expiresAt = claimCodeExpiresAt();
    const value: PendingClaim = {
      kind: "streak",
      customerId,
      organizationId,
      rewardId: pending.id,
      code,
      staffId,
      rewardName: STREAK_REWARD_NAME,
      cost: {},
      expiresAt,
      attempts: 0,
    };
    await cache.set(pendingClaimKey(pendingId), value, CLAIM_CODE_TTL_SECONDS);
    // Secondary index so the customer's app can rehydrate the active code on
    // reload (the realtime event won't re-fire). One active claim per customer.
    await cache.set(
      activeClaimKey(customerId),
      pendingId,
      CLAIM_CODE_TTL_SECONDS,
    );

    // `expiresAt` lets the customer's app run a live countdown and auto-clear.
    await this.publish(customerId, {
      event: "reward.claim-code",
      data: {
        kind: "streak",
        pendingId,
        rewardName: STREAK_REWARD_NAME,
        cost: {},
        code,
        expiresAt,
      },
    });
    await this.enqueue({
      customerIds: [customerId],
      organizationId,
      notificationKey: "reward-claim-code",
      payload: { rewardName: STREAK_REWARD_NAME, code },
    });

    return { pendingId, expiresAt };
  }

  /**
   * Customer-initiated cancel of a pending code-based streak claim. Idempotent
   * (missing → `{ ok: true }`), ownership-checked against the customer, and it
   * publishes `reward.claim-code-cancelled` so other tabs/devices clear.
   */
  async cancelClaim(
    customerId: string,
    pendingId: string,
  ): Promise<{ ok: true }> {
    const cache = requireCache(this.opts.cache);
    const { cancelled } = await cancelPendingClaim(cache, pendingId, customerId);
    if (cancelled) {
      await this.publish(customerId, {
        event: "reward.claim-code-cancelled",
        data: { pendingId },
      });
    }
    return { ok: true };
  }

  /**
   * Confirm a code-based streak claim: validate the OTP (existence, staff
   * binding, lockout, code match) then run the SAME deduction the scanner path
   * uses.
   */
  async confirmClaimWithCode(
    organizationId: string,
    staffId: string,
    pendingId: string,
    code: string,
  ): Promise<{ ok: true }> {
    const cache = requireCache(this.opts.cache);
    const pending = await verifyPendingClaim(cache, pendingId, code, staffId);

    const result = await this.runStreakClaim(
      organizationId,
      pending.customerId,
      pending.rewardId,
      staffId,
    );
    await cache.delete(pendingClaimKey(pendingId));
    await cache.delete(activeClaimKey(pending.customerId));
    return result;
  }

  /**
   * The deduction shared by the token path (`claimReward`) and the code path
   * (`confirmClaimWithCode`): mark the streak claimed, map the outcome, fire
   * the inline realtime confirmation + the durable notification.
   */
  private async runStreakClaim(
    organizationId: string,
    customerId: string,
    streakId: string,
    claimedByUserId: string,
  ): Promise<{ ok: true }> {
    const result = await this.repo.claimStreak({
      orgId: organizationId,
      streakId,
      customerId,
      claimedByUserId,
    });
    if (result.kind === "not_pending") {
      throw new TRPCError({ code: "CONFLICT", message: "ALREADY_CLAIMED" });
    }

    // Clear any lingering cashier-initiated code (path B) for this streak, so
    // the persistent "active code" banner disappears server-side after a scanner
    // (path A) claim. confirmClaimWithCode deletes its own pending — idempotent.
    await clearActiveClaim(this.opts.cache, customerId, streakId);

    await this.publish(customerId, {
      event: "streak.reward.claimed",
      data: { streakId },
    });
    await this.enqueue({
      customerIds: [customerId],
      organizationId,
      notificationKey: "streak-reward-claimed",
      payload: { streakId },
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
