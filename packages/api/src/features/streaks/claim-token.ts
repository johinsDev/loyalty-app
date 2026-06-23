import { jwtVerify, SignJWT } from "jose";

// Short-lived: the customer's app rotates it (re-issues on open) and the cashier
// scans within the window. Single-use is enforced by the streak state (a claimed
// streak can't be re-claimed), so the TTL only bounds staleness. Mirrors
// stamps/claim-token but with `kind: "streak-claim"` so the two token families
// can't be cross-claimed.
const CLAIM_TTL_SECONDS = 60;

/** Sign a single-use streak-reward claim token (HS256), rendered as the
 *  customer's QR. Reuses `REALTIME_AUTH_SECRET` — same signer as stamps. */
export async function signStreakClaimToken(params: {
  customerId: string;
  streakId: string;
  secret: string;
  ttlSeconds?: number;
}): Promise<{ token: string; expiresAt: string }> {
  const { customerId, streakId, secret, ttlSeconds = CLAIM_TTL_SECONDS } = params;
  if (!secret) throw new Error("signStreakClaimToken: secret is required");
  if (!customerId) throw new Error("signStreakClaimToken: customerId is required");

  const key = new TextEncoder().encode(secret);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expSeconds = nowSeconds + ttlSeconds;

  const token = await new SignJWT({ sid: streakId, kind: "streak-claim" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(customerId)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(expSeconds)
    .sign(key);

  return { token, expiresAt: new Date(expSeconds * 1000).toISOString() };
}

/** Verify a streak claim token; returns the customer + streak it authorizes.
 *  Throws on bad signature / wrong kind / expiry / malformed payload. */
export async function verifyStreakClaimToken(
  token: string,
  secret: string,
): Promise<{ customerId: string; streakId: string }> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
  if (payload.kind !== "streak-claim") throw new Error("not a streak claim token");
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("streak claim token missing subject");
  }
  if (typeof payload.sid !== "string" || payload.sid.length === 0) {
    throw new Error("streak claim token missing streak id");
  }
  return { customerId: payload.sub, streakId: payload.sid };
}
