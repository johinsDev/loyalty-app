// Pure tier math — no DB, fully testable. Given the tier-points earned in the
// window, resolves the current tier, the next one, and progress toward it.

import { NEAR_THRESHOLD_PCT, TIERS, type TierConfig } from "./config";

export interface TierView {
  current: TierConfig;
  next: TierConfig | null;
  /** 0..1 progress from the current tier's threshold to the next. */
  progress: number;
  remainingToNext: number;
  /** True once progress ≥ NEAR_THRESHOLD_PCT (drives the "almost there" nudge). */
  nearNext: boolean;
}

const ASC = [...TIERS].sort((a, b) => a.threshold - b.threshold);

export function tierFor(tierPoints: number): TierView {
  let current = ASC[0]!;
  let next: TierConfig | null = null;
  for (let i = 0; i < ASC.length; i += 1) {
    if (tierPoints >= ASC[i]!.threshold) {
      current = ASC[i]!;
      next = ASC[i + 1] ?? null;
    }
  }

  if (!next) {
    return { current, next: null, progress: 1, remainingToNext: 0, nearNext: false };
  }

  const span = next.threshold - current.threshold;
  const into = tierPoints - current.threshold;
  const progress = span > 0 ? Math.min(1, Math.max(0, into / span)) : 1;
  return {
    current,
    next,
    progress,
    remainingToNext: Math.max(0, next.threshold - tierPoints),
    nearNext: progress >= NEAR_THRESHOLD_PCT,
  };
}

/** Index of a tier in ascending order — to compare up vs down transitions. */
export function tierRank(key: string): number {
  return ASC.findIndex((t) => t.key === key);
}
