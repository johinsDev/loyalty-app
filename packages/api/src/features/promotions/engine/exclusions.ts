import { expandUnits } from "./match";
import type { Cart, CartUnit } from "./types";

/**
 * Units already consumed by a reward, removed from promo evaluation so a promo
 * can't discount what a reward already gave away (reward first, promos on the
 * remainder). Count-based per (line, source, modifier) group — a freed product
 * unit leaves its modifier units in the pool and vice versa.
 */
export interface UnitExclusion {
  lineIndex: number;
  source: "product" | "modifierOption";
  modifierOptionId?: string;
  count: number;
}

const sameGroup = (u: CartUnit, ex: UnitExclusion): boolean =>
  u.lineIndex === ex.lineIndex &&
  u.source === ex.source &&
  u.modifierOptionId === ex.modifierOptionId;

/** Group cart units into exclusion specs (count per line/source/modifier). */
export function toExclusions(units: CartUnit[]): UnitExclusion[] {
  const map = new Map<string, UnitExclusion>();
  for (const u of units) {
    const key = `${u.lineIndex}:${u.source}:${u.modifierOptionId ?? ""}`;
    const cur = map.get(key);
    if (cur) cur.count += 1;
    else
      map.set(key, {
        lineIndex: u.lineIndex,
        source: u.source,
        modifierOptionId: u.modifierOptionId,
        count: 1,
      });
  }
  return [...map.values()];
}

/** Indices of the first `count` units per exclusion group. */
export function excludedIndices(units: CartUnit[], exclusions: UnitExclusion[]): Set<number> {
  const out = new Set<number>();
  for (const ex of exclusions) {
    let remaining = ex.count;
    for (let i = 0; i < units.length && remaining > 0; i++) {
      const u = units[i];
      if (u && !out.has(i) && sameGroup(u, ex)) {
        out.add(i);
        remaining -= 1;
      }
    }
  }
  return out;
}

/** The unit pool minus the excluded units. */
export function applyExclusions(units: CartUnit[], exclusions: UnitExclusion[]): CartUnit[] {
  if (exclusions.length === 0) return units;
  const excluded = excludedIndices(units, exclusions);
  return units.filter((_, i) => !excluded.has(i));
}

/** Total amountCents the exclusions remove — used to reduce order-wide
 *  subtotals. A product unit carries its full line price, a modifier unit its
 *  delta; exclusions never hold both for the same line, so summing is exact. */
export function excludedAmountCents(cart: Cart, exclusions: UnitExclusion[]): number {
  if (exclusions.length === 0) return 0;
  const units = expandUnits(cart);
  const excluded = excludedIndices(units, exclusions);
  let total = 0;
  for (const i of excluded) total += units[i]?.amountCents ?? 0;
  return total;
}
