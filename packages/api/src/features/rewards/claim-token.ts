import { jwtVerify, SignJWT } from "jose";

// Short-lived: the customer's app rotates it (re-issues on open) and the cashier
// scans within the window. Single-use is enforced separately by the balance /
// once-count guards in the claim transaction, so the TTL only bounds staleness.
const CLAIM_TTL_SECONDS = 60;

export type ClaimCurrency = "stamps" | "points" | "both";

/** Sign a single-use reward-claim token (HS256), rendered as the customer's QR.
 *  Reuses `REALTIME_AUTH_SECRET` — same signer family as the realtime ticket.
 *  `rid` = reward id, `cur` = the currency the customer chose to pay with. */
export async function signRewardClaimToken(params: {
  customerId: string;
  rewardId: string;
  currency: ClaimCurrency;
  secret: string;
  ttlSeconds?: number;
}): Promise<{ token: string; expiresAt: string }> {
  const {
    customerId,
    rewardId,
    currency,
    secret,
    ttlSeconds = CLAIM_TTL_SECONDS,
  } = params;
  if (!secret) throw new Error("signRewardClaimToken: secret is required");
  if (!customerId) throw new Error("signRewardClaimToken: customerId is required");
  if (!rewardId) throw new Error("signRewardClaimToken: rewardId is required");

  const key = new TextEncoder().encode(secret);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expSeconds = nowSeconds + ttlSeconds;

  const token = await new SignJWT({
    rid: rewardId,
    cur: currency,
    kind: "reward-claim",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(customerId)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(expSeconds)
    .sign(key);

  return { token, expiresAt: new Date(expSeconds * 1000).toISOString() };
}

/** Verify a reward-claim token; returns the customer + reward + chosen currency
 *  it authorizes. Throws on bad signature / wrong kind / expiry / malformed. */
export async function verifyRewardClaimToken(
  token: string,
  secret: string,
): Promise<{ customerId: string; rewardId: string; currency: ClaimCurrency }> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
  if (payload.kind !== "reward-claim") throw new Error("not a reward-claim token");
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("reward-claim token missing subject");
  }
  if (typeof payload.rid !== "string" || payload.rid.length === 0) {
    throw new Error("reward-claim token missing reward id");
  }
  const cur = payload.cur;
  if (cur !== "stamps" && cur !== "points" && cur !== "both") {
    throw new Error("reward-claim token has invalid currency");
  }
  return { customerId: payload.sub, rewardId: payload.rid, currency: cur };
}
