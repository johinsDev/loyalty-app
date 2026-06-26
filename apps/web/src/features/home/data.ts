import { Flower2, Leaf } from "lucide-react";

/**
 * Hardcoded demo data for the customer home. Everything here is sample content
 * until the wallet/ledger + promos features land — the screen is a faithful
 * build of the "T4 Lovers · Home / Sellos" Claude Design templates. Chrome copy
 * (section labels, nav, CTAs) is translated via the `Home` messages namespace;
 * the values below are content (names, amounts, dates) and stay inline.
 */

export const customer = { name: "Ari", emoji: "🍵" } as const;

/** Points wallet — the ring + tier model. */
export const pointsWallet = {
  points: 312,
  tier: "Hoja",
  tierIcon: Leaf,
  toNextReward: 288,
  // Stroke geometry for the progress ring (r=68 → circumference ≈ 427).
  ringCircumference: 427,
  ringOffset: 218,
  nextTier: { name: "Flor", icon: Flower2, at: 600 },
  tierProgress: 0.35,
} as const;
