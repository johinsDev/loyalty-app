import { POINTS_ENABLED, pointsForPrice } from "../points";

import type { EarnPreview } from "./schemas";

/** Display-only earn preview for a price: points (if enabled) + a stamp.
 *  Stamps are always +1 per purchase in the pilot. */
export function earnFor(priceCents: number): EarnPreview {
  return {
    points: POINTS_ENABLED ? pointsForPrice(priceCents) : 0,
    stamp: true,
  };
}
