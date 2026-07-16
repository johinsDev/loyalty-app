import {
  earnsPoints,
  earnsStamps,
  type LoyaltyConfig,
  rateForCurrency,
} from "../_shared/localize";
import { POINTS_ENABLED, pointsForPrice } from "../points";

import type { EarnPreview } from "./schemas";

/**
 * Display-only earn preview for a price. `cfg` is the org's loyalty config
 * (mode + per-currency rates); `currency` should be the currency the price is
 * expressed in (catalog base prices → the org default currency). Omitting the
 * config keeps the legacy compile-time behavior.
 */
export function earnFor(
  priceCents: number,
  cfg?: LoyaltyConfig,
  currency?: string,
): EarnPreview {
  const pointsOn = POINTS_ENABLED && (cfg ? earnsPoints(cfg.mode) : true);
  const rate = cfg && currency ? rateForCurrency(cfg, currency) : undefined;
  return {
    points: pointsOn ? pointsForPrice(priceCents, rate) : 0,
    stamp: cfg ? earnsStamps(cfg.mode) : true,
  };
}
