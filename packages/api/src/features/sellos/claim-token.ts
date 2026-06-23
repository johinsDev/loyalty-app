import { jwtVerify, SignJWT } from "jose";

// Short-lived: the customer's app rotates it (re-issues on open) and the cashier
// scans within the window. Single-use is enforced separately by the wallet state
// (a claimed wallet can't be re-claimed), so the TTL only bounds staleness.
const CLAIM_TTL_SECONDS = 60;

/** Sign a single-use reward-claim token (HS256), rendered as the customer's QR.
 *  Reuses `REALTIME_AUTH_SECRET` — same signer family as the realtime ticket. */
export async function signClaimToken(params: {
  customerId: string;
  walletId: string;
  secret: string;
  ttlSeconds?: number;
}): Promise<{ token: string; expiresAt: string }> {
  const { customerId, walletId, secret, ttlSeconds = CLAIM_TTL_SECONDS } = params;
  if (!secret) throw new Error("signClaimToken: secret is required");
  if (!customerId) throw new Error("signClaimToken: customerId is required");

  const key = new TextEncoder().encode(secret);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expSeconds = nowSeconds + ttlSeconds;

  const token = await new SignJWT({ wid: walletId, kind: "claim" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(customerId)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(expSeconds)
    .sign(key);

  return { token, expiresAt: new Date(expSeconds * 1000).toISOString() };
}

/** Verify a claim token; returns the customer + wallet it authorizes. Throws on
 *  bad signature / wrong kind / expiry / malformed payload. */
export async function verifyClaimToken(
  token: string,
  secret: string,
): Promise<{ customerId: string; walletId: string }> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
  if (payload.kind !== "claim") throw new Error("not a claim token");
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("claim token missing subject");
  }
  if (typeof payload.wid !== "string" || payload.wid.length === 0) {
    throw new Error("claim token missing wallet id");
  }
  return { customerId: payload.sub, walletId: payload.wid };
}
