/**
 * The data one points-card template renders. Templates are PURE presentational
 * (no tRPC, no i18n, no modal) — the web container builds this from
 * `points.mySummary` + its translations, and the admin gallery feeds sample
 * data. Shared so the admin preview IS the customer render (they can't drift).
 */
export interface PointsCardView {
  /** Spendable balance (raw — templates animate it via the count-up). */
  balance: number;
  /** Locale-aware formatter for the balance (compact for big numbers). */
  formatBalance: (n: number) => string;
  tierName: string;
  /** Tier accent (hex) from the tier config. */
  tierColor: string;
  /** Tier icon key (`leaf` | `flower` | `crown`; anything else → sparkles). */
  tierIconKey: string;
  /** 0..1 toward the next tier (0 when already at the top). */
  progress: number;
  nextTierName: string | null;
  nextThreshold: number | null;
  /** Preformatted "X pts to reach Y" copy; null when at the top tier. */
  nextLabel: string | null;
  /** Copy for the top tier ("Nivel máximo"). */
  maxLabel: string;
  /** Non-null → earning is paused; the string is the redeem-only notice. */
  pausedLabel: string | null;
  /** ARIA label for the tap-to-open-detail affordance. */
  detailAriaLabel: string;
  /** Tap handler (opens the detail modal in the app; no-op in previews). */
  onPress?: () => void;
}
