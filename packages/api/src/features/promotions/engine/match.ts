import type { PromoItemRef, PromoLineRequirement, PromoRule } from "@loyalty/db/schema";

import type { Cart, CartUnit, MatchResult, RuleApplication } from "./types";

/** Expand cart lines into matchable units: `qty` product units per line plus
 *  one modifier unit per modifier option per qty (priced at its delta). */
export function expandUnits(cart: Cart): CartUnit[] {
  const out: CartUnit[] = [];
  cart.lines.forEach((line, lineIndex) => {
    for (let i = 0; i < line.qty; i++) {
      out.push({ lineIndex, amountCents: line.unitAmountCents, source: "product" });
      for (const mod of line.modifierOptions ?? []) {
        out.push({
          lineIndex,
          amountCents: mod.priceDeltaCents,
          source: "modifierOption",
          modifierOptionId: mod.id,
        });
      }
    }
  });
  return out;
}

function refMatchesUnit(ref: PromoItemRef, unit: CartUnit, cart: Cart): boolean {
  const line = cart.lines[unit.lineIndex];
  if (!line) return false;
  switch (ref.kind) {
    case "product":
      return unit.source === "product" && line.productId === ref.id;
    case "variant":
      return unit.source === "product" && line.variantId === ref.id;
    case "category":
      return unit.source === "product" && (line.categoryIds ?? []).includes(ref.id);
    case "modifierOption":
      return unit.source === "modifierOption" && unit.modifierOptionId === ref.id;
    default:
      return false;
  }
}

/** Empty refs = any product unit in the cart. */
function unitMatches(refs: PromoItemRef[], unit: CartUnit, cart: Cart): boolean {
  if (refs.length === 0) return unit.source === "product";
  return refs.some((ref) => refMatchesUnit(ref, unit, cart));
}

/** Pick `qty` most-expensive available units matching the requirement, or null
 *  when the cart can't satisfy it. Most-expensive-first keeps consumption
 *  deterministic and customer-favorable (effects then discount the cheapest
 *  units within the matched set). */
function pickUnits(
  req: PromoLineRequirement,
  units: CartUnit[],
  available: boolean[],
  takenThisApp: Set<number>,
  cart: Cart,
): number[] | null {
  const candidates: number[] = [];
  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    if (!unit || !available[i] || takenThisApp.has(i)) continue;
    if (unitMatches(req.refs, unit, cart)) candidates.push(i);
  }
  if (candidates.length < req.qty) return null;
  candidates.sort((a, b) => (units[b]?.amountCents ?? 0) - (units[a]?.amountCents ?? 0));
  return candidates.slice(0, req.qty);
}

/**
 * Assign cart units to rule applications. Each application satisfies every
 * buy requirement then every get requirement; a unit is consumed at most once
 * across all applications and across buy/get. Loops while the cart still
 * satisfies the rule and `maxApplicationsPerOrder` allows.
 */
export function matchRule(cart: Cart, rule: PromoRule): MatchResult {
  const units = expandUnits(cart);
  const available = units.map(() => true);
  const applications: RuleApplication[] = [];
  const maxApps = rule.maxApplicationsPerOrder ?? Number.POSITIVE_INFINITY;
  let missingGetSide: PromoItemRef[] = [];

  while (applications.length < maxApps) {
    const taken = new Set<number>();
    const buyUnits: CartUnit[] = [];
    let buySatisfied = true;
    for (const req of rule.buy.requirements) {
      const picked = pickUnits(req, units, available, taken, cart);
      if (!picked) {
        buySatisfied = false;
        break;
      }
      for (const i of picked) {
        taken.add(i);
        const unit = units[i];
        if (unit) buyUnits.push(unit);
      }
    }
    if (!buySatisfied) break;

    const getUnits: CartUnit[] = [];
    const missing: PromoItemRef[] = [];
    for (const req of rule.get?.requirements ?? []) {
      const picked = pickUnits(req, units, available, taken, cart);
      if (!picked) {
        missing.push(...req.refs);
        continue;
      }
      for (const i of picked) {
        taken.add(i);
        const unit = units[i];
        if (unit) getUnits.push(unit);
      }
    }
    if (missing.length > 0) {
      if (applications.length === 0) missingGetSide = missing;
      break;
    }

    for (const i of taken) available[i] = false;
    applications.push({ buyUnits, getUnits });
    if (taken.size === 0) break; // zero-consumption rule (e.g. order-wide) applies once
  }

  return { applications, missingGetSide };
}
