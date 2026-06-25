import { Crown, Flower2, Leaf, Sparkles } from "lucide-react";
import type { ComponentType } from "react";

const TIER_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  leaf: Leaf,
  flower: Flower2,
  crown: Crown,
};

/** Maps a `TierConfig.icon` key to its lucide component (Sparkles fallback). */
export const tierIcon = (key: string) => TIER_ICONS[key] ?? Sparkles;
