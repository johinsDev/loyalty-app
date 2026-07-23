import { TRPCError } from "@trpc/server";

import type { CacheBinding } from "../../trpc";
import { generateClaimCode } from "./claim-code";

/**
 * Quick-register PIN — the cashier registers a new customer (name + phone) at
 * the POS, a 6-digit code is sent to that phone over WhatsApp, and the customer
 * reads it back before the account is actually created. This blocks the sale
 * until the number is proven reachable + consented, so a mistyped phone never
 * mints a ghost account.
 *
 * Mirrors the reward claim-code lifecycle (`claim-code.ts`): cache-backed, staff
 * bound, attempt-limited, TTL-expired — but the pending payload is a
 * to-be-created customer, not a redemption.
 */

/** How long a quick-register PIN is valid, in seconds (matches auth phone-OTP). */
export const REGISTER_PIN_TTL_SECONDS = 300;

/** Wrong-PIN attempts allowed before the pending registration is burned. */
export const REGISTER_PIN_MAX_ATTEMPTS = 3;

export function registerPinKey(pendingId: string): string {
  return `register-pin:${pendingId}`;
}

/** The to-be-created customer held in the cache between request and confirm. */
export interface PendingRegister {
  /** E.164 phone the PIN was sent to (also the future login identifier). */
  phone: string;
  name: string | null;
  organizationId: string;
  /** Staff user id that started the registration — binds confirmation to them. */
  staffId: string;
  /** The active store the sale is on, captured as the acquisition store. */
  acquisitionStoreId: string | null;
  code: string;
  attempts: number;
}

/**
 * Generate a PIN, persist the pending registration, and return both the
 * pendingId (the cashier confirms against it) and the code (the caller sends it
 * over WhatsApp). The code is never returned to the client.
 */
export async function storePendingRegister(
  cache: CacheBinding,
  data: Omit<PendingRegister, "code" | "attempts">,
): Promise<{ pendingId: string; code: string }> {
  const pendingId = crypto.randomUUID();
  const code = generateClaimCode();
  await cache.set(
    registerPinKey(pendingId),
    { ...data, code, attempts: 0 } satisfies PendingRegister,
    REGISTER_PIN_TTL_SECONDS,
  );
  return { pendingId, code };
}

/**
 * Load + validate a pending registration for confirmation. Same guarantees as
 * `verifyPendingClaim`: existence (→ CODE_EXPIRED), staff binding
 * (→ NOT_YOUR_CLAIM), attempt lockout (→ TOO_MANY_ATTEMPTS, burns the pending),
 * code match (→ CODE_INVALID, persists the incremented attempt under the same
 * TTL). Returns the validated payload on a correct code; the caller then mints
 * the customer and deletes the key.
 */
export async function verifyRegisterPin(
  cache: CacheBinding,
  pendingId: string,
  code: string,
  staffId: string,
): Promise<PendingRegister> {
  const key = registerPinKey(pendingId);
  const pending = await cache.get<PendingRegister>(key);
  if (!pending) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "CODE_EXPIRED" });
  }
  if (pending.staffId !== staffId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "NOT_YOUR_CLAIM" });
  }

  const attempts = pending.attempts + 1;
  if (attempts > REGISTER_PIN_MAX_ATTEMPTS) {
    await cache.delete(key);
    throw new TRPCError({ code: "BAD_REQUEST", message: "TOO_MANY_ATTEMPTS" });
  }
  if (pending.code !== code) {
    await cache.set(key, { ...pending, attempts }, REGISTER_PIN_TTL_SECONDS);
    throw new TRPCError({ code: "BAD_REQUEST", message: "CODE_INVALID" });
  }

  return pending;
}

/** Delete a pending registration once the customer is created. */
export async function clearPendingRegister(
  cache: CacheBinding,
  pendingId: string,
): Promise<void> {
  await cache.delete(registerPinKey(pendingId));
}
