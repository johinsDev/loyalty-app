/**
 * The data one stamp-card template renders. Templates are PURE presentational
 * (no tRPC, no i18n, no modal) — the web container builds this from
 * `stamps.myWallet` + `settings.loyaltyConfig` + its translations, and the
 * admin gallery feeds sample data. Shared so the admin preview IS the customer
 * render (they can't drift).
 */
export interface StampCardView {
  /** Stamps needed for the prize; the card shows `goal + 1` spots. */
  goal: number;
  /** Filled spots in the current cycle (`currentStamps % goal`). */
  filledInCycle: number;
  /** Lifetime spendable balance (shown as the counter, e.g. "12 sellos"). */
  totalStamps: number;
  /** Progress toward the NEXT stamp when the org grants 1 per N purchases;
   *  null when N = 1 (nothing to show). */
  pending: { have: number; need: number } | null;
  /** Stamp glyph: a curated key or an uploaded image URL (mask-rendered). */
  icon: { kind: "lucide" | "image"; value: string };
  /** Hex for the filled stamp; null → the brand primary. */
  onColor: string | null;
  /** How an unearned spot renders. */
  offStyle: "dim" | "outline" | "number";
  title: string;
  /** Motivational line under the title ("N to go"); already interpolated. */
  subtitle: string;
  /** Counter label ("12 sellos"); already formatted. */
  countLabel: string;
  /** "2/3 visits to your next stamp" line; null when not applicable. */
  pendingLabel: string | null;
  /** Non-null → earning is paused; the string is the redeem-only notice. */
  pausedLabel: string | null;
  /** Prize name shown near the reward spot (linked reward or generic copy). */
  prizeName: string | null;
  /** ARIA label builder for a spot ("Sello 3 de 10, ganado"). */
  spotAriaLabel: (spot: StampSpot) => string;
  /** Tap handler for a spot (opens the detail modal; no-op in previews). */
  onSpotPress?: (spot: StampSpot) => void;
}

export interface StampSpot {
  /** 1-based position on the card (1 .. goal + 1). */
  index: number;
  kind: "filled" | "empty" | "reward";
}
