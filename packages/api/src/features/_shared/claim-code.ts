import { TRPCError } from "@trpc/server";

import type { CacheBinding } from "../../trpc";

/**
 * Cashier-initiated claim authorization via a 6-digit OTP — the "no scanner"
 * path that parallels the signed-QR claim. The customer's app shows a code; the
 * cashier types it to confirm presence. The pending claim lives in the cache
 * for a short window, bound to the staff member who requested it.
 *
 * Shared by `rewards` and `streaks` so the OTP lifecycle (generation, storage,
 * staff binding, attempt lockout, expiry) can't drift between the two loops.
 */

/** How long a pending code is valid, in seconds. */
export const CLAIM_CODE_TTL_SECONDS = 180;

/** Wrong-code attempts allowed before the pending claim is burned. */
export const CLAIM_CODE_MAX_ATTEMPTS = 3;

/** Cache key for a pending code-based claim. */
export function pendingClaimKey(pendingId: string): string {
  return `claim-otp:${pendingId}`;
}

/**
 * Secondary index key: maps a customer to their single active pending claim id,
 * so the customer's app can rehydrate the active code on load (the realtime
 * `reward.claim-code` event doesn't re-fire after a reload). One active claim
 * per customer — a newer requestClaim overwrites the index.
 */
export function activeClaimKey(customerId: string): string {
  return `active-claim:${customerId}`;
}

/** Discriminates the two reward loops that share the OTP flow. */
export type PendingClaimKind = "reward" | "streak";

/** A single payable currency for an OR reward (the customer's choice). */
export type ClaimCurrencyChoice = "stamps" | "points";

/**
 * What we persist for a pending code-based claim. The `currency` is only
 * meaningful for `kind: "reward"`; streaks deduct a fixed reward. `rewardId`
 * carries the reward id (rewards) or the streak id (streaks).
 */
export interface PendingClaim {
  kind: PendingClaimKind;
  customerId: string;
  organizationId: string;
  /** Reward id (rewards) or streak id (streaks). */
  rewardId: string;
  /** Only set for reward claims. For an OR reward affordable with BOTH
   *  currencies this is left `undefined` until the customer picks one on their
   *  phone (see `setClaimCurrency`); single-affordable / "and" decide it here. */
  currency?: "stamps" | "points" | "both";
  /** Currencies the customer can pay this reward with right now (rewards only).
   *  When length > 1 the customer chooses; `confirmClaimWithCode` defaults to
   *  `affordableWith[0]` if they never picked. */
  affordableWith?: ClaimCurrencyChoice[];
  /** The 6-digit code the customer must read out / show. */
  code: string;
  /** Staff user id that requested the claim — binds confirmation to them. */
  staffId: string;
  /** Human label for the realtime/notification payload. */
  rewardName: string;
  /** Cost shown to the customer (rewards only; streaks deduct a fixed reward). */
  cost?: { stamps?: number; points?: number };
  /** ISO timestamp the code expires — returned by `myActiveClaim` to drive the
   *  rehydrated countdown without recomputing it. */
  expiresAt: string;
  /** Wrong-code attempts so far. */
  attempts: number;
}

/**
 * Generate a 6-digit numeric code using the platform CSPRNG (workerd-safe — no
 * `Math.random`). Rejection-samples to avoid modulo bias across [0, 999999].
 */
export function generateClaimCode(): string {
  const buf = new Uint32Array(1);
  // 2^32 = 4294967296; the largest multiple of 1_000_000 below it is
  // 4294000000 — values at/above that would bias the low digits, so resample.
  const limit = 4_294_000_000;
  let n: number;
  do {
    crypto.getRandomValues(buf);
    n = buf[0]!;
  } while (n >= limit);
  return String(n % 1_000_000).padStart(6, "0");
}

/** Expiry timestamp for a freshly-created pending claim. */
export function claimCodeExpiresAt(now: Date = new Date()): string {
  return new Date(now.getTime() + CLAIM_CODE_TTL_SECONDS * 1000).toISOString();
}

/** Throws PRECONDITION_FAILED("CACHE_REQUIRED") when no cache is bound — the
 *  code path can't run without somewhere to hold the pending claim. */
export function requireCache(cache: CacheBinding | undefined): CacheBinding {
  if (!cache) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "CACHE_REQUIRED",
    });
  }
  return cache;
}

/**
 * Load + validate a pending claim for confirmation. Enforces: existence
 * (→ CODE_EXPIRED), staff binding (→ NOT_YOUR_CLAIM), attempt lockout
 * (→ TOO_MANY_ATTEMPTS, burns the pending), and the code match
 * (→ CODE_INVALID, persists the incremented attempt count under the same TTL).
 * Returns the validated pending claim on a correct code; the caller then runs
 * the deduction and deletes the key.
 */
export async function verifyPendingClaim(
  cache: CacheBinding,
  pendingId: string,
  code: string,
  staffId: string,
): Promise<PendingClaim> {
  const key = pendingClaimKey(pendingId);
  const pending = await cache.get<PendingClaim>(key);
  if (!pending) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "CODE_EXPIRED" });
  }
  if (pending.staffId !== staffId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "NOT_YOUR_CLAIM" });
  }

  const attempts = pending.attempts + 1;
  if (attempts > CLAIM_CODE_MAX_ATTEMPTS) {
    await cache.delete(key);
    throw new TRPCError({ code: "BAD_REQUEST", message: "TOO_MANY_ATTEMPTS" });
  }

  if (pending.code !== code) {
    // Persist the incremented attempt count back under the same TTL so the
    // lockout survives across calls.
    await cache.set(
      key,
      { ...pending, attempts },
      CLAIM_CODE_TTL_SECONDS,
    );
    throw new TRPCError({ code: "BAD_REQUEST", message: "CODE_INVALID" });
  }

  return pending;
}

/**
 * Customer-initiated revoke of a pending code-based claim (the "I closed the
 * modal by accident / I changed my mind" path). Idempotent: a missing pending
 * (already expired/claimed/cancelled) resolves to `cancelled: false` rather
 * than throwing, so the customer never sees an error for racing the TTL.
 *
 * Ownership is enforced against the *customer* (not the staff binding that
 * `verifyPendingClaim` checks): only the customer the code was minted for may
 * cancel it (→ FORBIDDEN "NOT_YOUR_CLAIM"). On a match the key is deleted so
 * the cashier's `confirmClaimWithCode` then fails CODE_EXPIRED.
 *
 * Returns whether a pending was actually deleted (`cancelled`) plus its `kind`
 * so the caller can publish the right realtime event without re-reading.
 */
export async function cancelPendingClaim(
  cache: CacheBinding,
  pendingId: string,
  customerId: string,
): Promise<{ cancelled: boolean; kind?: PendingClaimKind }> {
  const key = pendingClaimKey(pendingId);
  const pending = await cache.get<PendingClaim>(key);
  if (!pending) {
    // Already gone — idempotent success.
    return { cancelled: false };
  }
  if (pending.customerId !== customerId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "NOT_YOUR_CLAIM" });
  }
  await cache.delete(key);
  await cache.delete(activeClaimKey(pending.customerId));
  return { cancelled: true, kind: pending.kind };
}

/**
 * Best-effort clear of a customer's active code-based pending claim — used when
 * the SAME reward is claimed through the signed-QR scanner path. Without this,
 * a lingering cashier-initiated code (path B) would keep the "active code"
 * banner alive and stay reusable after the scanner claim already deducted.
 *
 * Reads `active-claim:<customerId>` → pendingId → the pending. When `rewardId`
 * is given, only clears if `pending.rewardId === rewardId` (so an unrelated
 * code for a different reward is left intact). Deletes both the pending and the
 * index. No-ops when there's no cache, no index, or no pending. Never throws —
 * keeping the deduction's success path resilient.
 */
export async function clearActiveClaim(
  cache: CacheBinding | undefined,
  customerId: string,
  rewardId?: string,
): Promise<void> {
  if (!cache) return;
  try {
    const indexKey = activeClaimKey(customerId);
    const pendingId = await cache.get<string>(indexKey);
    if (!pendingId) return;

    const pending = await cache.get<PendingClaim>(pendingClaimKey(pendingId));
    if (!pending) {
      // Dangling index — clean it up regardless.
      await cache.delete(indexKey);
      return;
    }
    if (rewardId != null && pending.rewardId !== rewardId) return;

    await cache.delete(pendingClaimKey(pendingId));
    await cache.delete(indexKey);
  } catch {
    // best-effort
  }
}

/** What the customer's app needs to rehydrate the active-code surfaces. */
export interface ActiveClaimView {
  pendingId: string;
  code: string;
  rewardName: string;
  cost?: { stamps?: number; points?: number };
  expiresAt: string;
  kind: PendingClaimKind;
  /** Currencies the customer can pay with (rewards only). When length > 1 the
   *  customer chooses on their phone; otherwise it's already decided. */
  affordableWith?: ClaimCurrencyChoice[];
  /** The chosen currency, or `undefined` while the customer hasn't picked yet
   *  for an OR-both reward. */
  currency?: ClaimCurrencyChoice;
}

/**
 * Customer-initiated currency pick for an OR reward affordable with both
 * stamps and points (the chooser moved to the customer's phone). Validates that
 * the pending exists, belongs to this customer, and the requested currency is
 * in its `affordableWith`; then persists the chosen `currency` under the same
 * TTL so `confirmClaimWithCode` deducts from the right balance.
 *
 * Throws CODE_EXPIRED (missing), NOT_YOUR_CLAIM (foreign), CURRENCY_NOT_ALLOWED
 * (not affordable). Returns `{ ok: true }` on success.
 */
export async function setPendingClaimCurrency(
  cache: CacheBinding,
  pendingId: string,
  customerId: string,
  currency: ClaimCurrencyChoice,
): Promise<{ ok: true }> {
  const key = pendingClaimKey(pendingId);
  const pending = await cache.get<PendingClaim>(key);
  if (!pending) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "CODE_EXPIRED" });
  }
  if (pending.customerId !== customerId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "NOT_YOUR_CLAIM" });
  }
  if (!pending.affordableWith?.includes(currency)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "CURRENCY_NOT_ALLOWED",
    });
  }

  // Recompute the remaining TTL so the choice doesn't extend the code's life.
  const remainingMs = new Date(pending.expiresAt).getTime() - Date.now();
  const ttl = Math.max(1, Math.ceil(remainingMs / 1000));
  await cache.set(key, { ...pending, currency }, ttl);
  return { ok: true };
}

/**
 * Server-authoritative lookup of the customer's current active claim, used to
 * rehydrate the app after a reload (when the realtime event won't re-fire).
 *
 * Reads the `active-claim:<customerId>` index → the pending. Returns null (the
 * common "nothing active" case) when there's no cache bound, no index, or the
 * pending has expired/been claimed. A dangling index (pending gone) is cleaned
 * up best-effort. Ownership is re-checked defensively against the customer.
 */
export async function loadActiveClaim(
  cache: CacheBinding | undefined,
  customerId: string,
): Promise<ActiveClaimView | null> {
  if (!cache) return null;
  const indexKey = activeClaimKey(customerId);
  const pendingId = await cache.get<string>(indexKey);
  if (!pendingId) return null;

  const pending = await cache.get<PendingClaim>(pendingClaimKey(pendingId));
  if (!pending) {
    // Stale index (the pending expired/was claimed) — clean it up and report
    // nothing active.
    await cache.delete(indexKey);
    return null;
  }
  if (pending.customerId !== customerId) return null;

  return {
    pendingId,
    code: pending.code,
    rewardName: pending.rewardName,
    cost: pending.cost,
    expiresAt: pending.expiresAt,
    kind: pending.kind,
    affordableWith: pending.affordableWith,
    // Only surface a single decided currency; "both" (an "and" reward) is not a
    // customer choice and stays out of the OR toggle.
    currency:
      pending.currency === "stamps" || pending.currency === "points"
        ? pending.currency
        : undefined,
  };
}
