import { rewards, stampsBalance } from "@/features/rewards/data";

/**
 * Hardcoded member identity for the "Mi código" QR screen — design-first until
 * the wallet/ledger + member API land. The QR payload uses the real session id;
 * `number` is the human-readable member code shown on the card.
 */
export const member = {
  name: "Ari Tanaka",
  initial: "A",
  tierEmoji: "🌿",
  tierName: "Hoja",
  points: 312,
  number: "T4 ·· 4821",
} as const;

export type AttachableReward = {
  id: string;
  emoji: string;
  name: string;
  cost: number;
};

/**
 * Rewards the member can attach to the QR to redeem in the same scan — the
 * affordable ones from the shared rewards catalog, so there's a single source
 * of truth with the rewards screen.
 */
export const attachableRewards: readonly AttachableReward[] = rewards
  .filter((reward) => reward.cost <= stampsBalance)
  .map((reward) => ({
    id: reward.id,
    emoji: reward.emoji,
    name: reward.name,
    cost: reward.cost,
  }));
