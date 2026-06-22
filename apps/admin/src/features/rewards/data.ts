// Hardcoded rewards catalog for the design-first Recompensas CRUD. Seam: the
// Phase A reward model (cost in stamps or points). T4 pilot = stamps; points is
// configurable per the loyalty-model decision.

export type CostType = "stamps" | "points";

export type Reward = {
  id: string;
  name: string;
  emoji: string;
  costType: CostType;
  cost: number;
  active: boolean;
  redeemed: number;
};

export const rewards: Reward[] = [
  { id: "r_001", name: "Bubble tea gratis", emoji: "🧋", costType: "stamps", cost: 10, active: true, redeemed: 342 },
  { id: "r_002", name: "Topping gratis", emoji: "🍮", costType: "points", cost: 200, active: true, redeemed: 188 },
  { id: "r_003", name: "Upgrade a tamaño L", emoji: "⬆️", costType: "points", cost: 120, active: true, redeemed: 96 },
  { id: "r_004", name: "2×1 entre semana", emoji: "🎉", costType: "stamps", cost: 6, active: true, redeemed: 71 },
  { id: "r_005", name: "Bebida de cumpleaños", emoji: "🎂", costType: "points", cost: 0, active: true, redeemed: 54 },
  { id: "r_006", name: "Llavero T4", emoji: "🔑", costType: "points", cost: 500, active: false, redeemed: 12 },
];

export type RewardDraft = {
  name: string;
  emoji: string;
  description: string;
  costType: CostType;
  cost: number;
};

export const emptyRewardDraft: RewardDraft = {
  name: "",
  emoji: "🎁",
  description: "",
  costType: "stamps",
  cost: 10,
};

/** Resolve a reward into an editable draft. Hardcoded — unknown ids fall back to
 * the first reward so deep links never 404 in the design build. */
export function getRewardDraft(id: string): RewardDraft {
  const r = rewards.find((x) => x.id === id) ?? rewards[0]!;
  return {
    name: r.name,
    emoji: r.emoji,
    description: "Canjea este premio con tus sellos o puntos acumulados.",
    costType: r.costType,
    cost: r.cost,
  };
}

export const REWARD_EMOJIS = ["🎁", "🧋", "🍮", "⬆️", "🎉", "🎂", "🔑", "⭐"];
