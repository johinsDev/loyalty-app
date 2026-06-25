import type { PointsTransactionKind } from "./schemas";

const REWARD_REASON_PREFIX = "reward:";

/**
 * Classify a raw ledger row's `(type, reason)` into a UI-friendly `kind` plus,
 * for redeem rows whose reason is `reward:<rewardId>`, the referenced reward id
 * (so the repository can resolve the reward NAME). Pure — no DB — so it's unit
 * testable and the raw `reward:<id>` reason never leaks to the client.
 */
export function classifyTransaction(
  type: string,
  reason: string | null,
): { kind: PointsTransactionKind; rewardId: string | null } {
  if (type === "redeem") {
    if (reason?.startsWith(REWARD_REASON_PREFIX)) {
      const rewardId = reason.slice(REWARD_REASON_PREFIX.length);
      return { kind: "reward", rewardId: rewardId || null };
    }
    return { kind: "other", rewardId: null };
  }
  if (type === "adjust") return { kind: "adjust", rewardId: null };
  // earn — a purchase unless tagged otherwise.
  if (reason === null || reason === "purchase") {
    return { kind: "purchase", rewardId: null };
  }
  return { kind: "other", rewardId: null };
}
