/**
 * The variant option graph, as pure functions over rows.
 *
 * This logic used to live inside `PromoRepository.variantUpgradeDeltas`, welded
 * to its three queries — which is why it had no tests at all: `packages/api` has
 * no DB-backed harness, so anything holding a `db` handle is untestable here.
 * Splitting "fetch rows" from "reason about option combinations" is what makes
 * the reasoning verifiable, and it has two consumers now: the register (which
 * needs deltas for a cart) and the admin axis picker (which needs coverage).
 *
 * The vocabulary these functions match on is per-product free text
 * (`product_option.product_id`), duplicated across products with no shared
 * catalog. Two products both spelling it "Tamaño" is convention, not a
 * constraint — so every function here treats a missing or differently-spelled
 * label as "this product doesn't qualify", never as an error.
 */

/** One variant, with its option combo flattened to (option name → value label). */
export interface VariantNode {
  variantId: string;
  productId: string;
  /** Effective base price: the promotional price when set, else the list price. */
  priceCents: number;
  options: ReadonlyMap<string, string>;
}

export interface UpgradeTarget {
  variantId: string;
  deltaCents: number;
}

/** Canonical key for an option combo, order-independent. */
function signature(options: ReadonlyMap<string, string>): string {
  return [...options.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("|");
}

/** `product||signature` → variant. Lets us find the sibling that differs on
 *  exactly one axis. A product with two variants carrying the identical combo
 *  is malformed; last one wins, deterministically. */
function indexByCombo(nodes: VariantNode[]): Map<string, VariantNode> {
  const out = new Map<string, VariantNode>();
  for (const n of nodes) out.set(`${n.productId}||${signature(n.options)}`, n);
  return out;
}

/**
 * For each variant sitting at `fromValueLabel` on `optionName`, the sibling at
 * `toValueLabel` and what the step costs.
 *
 * The sibling must match on **every other axis**: a Mediano/Deslactosada
 * upgrades to Grande/Deslactosada, never to Grande/Entera.
 *
 * Keyed by the SOURCE variant — the reward now finds a cart line the customer
 * already has and offers to move it up. It used to be keyed by the target, which
 * meant the line had to already be the expensive one for the reward to apply.
 */
export function upgradeTargets(
  nodes: VariantNode[],
  optionName: string,
  fromValueLabel: string,
  toValueLabel: string,
): Map<string, UpgradeTarget> {
  const out = new Map<string, UpgradeTarget>();
  if (fromValueLabel === toValueLabel) return out;
  const byCombo = indexByCombo(nodes);

  for (const node of nodes) {
    if (node.options.get(optionName) !== fromValueLabel) continue;
    const targetOptions = new Map(node.options);
    targetOptions.set(optionName, toValueLabel);
    const target = byCombo.get(`${node.productId}||${signature(targetOptions)}`);
    if (!target) continue;
    const deltaCents = target.priceCents - node.priceCents;
    // A target that costs the same or less is not an upgrade. Filtering here is
    // what guarantees the reward never produces a zero or negative discount.
    if (deltaCents > 0) {
      out.set(node.variantId, { variantId: target.variantId, deltaCents });
    }
  }
  return out;
}

export type AxisMissReason = "no-axis" | "no-from" | "no-to" | "not-pricier";

export interface AxisValue {
  label: string;
  productCount: number;
}

export interface AxisSummary {
  optionName: string;
  values: AxisValue[];
  /** Products carrying this axis, of the products in scope. */
  coveredCount: number;
  missingProductIds: string[];
}

/**
 * Every option axis present across `productIds`, with how many of them carry it.
 *
 * Derived from the variants rather than from `product_option` on purpose: an
 * axis with no variants behind it can never produce an upgrade, so listing it
 * would offer the admin a choice that silently does nothing.
 */
export function axisSummaries(nodes: VariantNode[], productIds: string[]): AxisSummary[] {
  const productsByAxis = new Map<string, Set<string>>();
  const valueProducts = new Map<string, Map<string, Set<string>>>();

  for (const node of nodes) {
    for (const [optionName, label] of node.options) {
      const products = productsByAxis.get(optionName) ?? new Set<string>();
      products.add(node.productId);
      productsByAxis.set(optionName, products);

      const values = valueProducts.get(optionName) ?? new Map<string, Set<string>>();
      const forLabel = values.get(label) ?? new Set<string>();
      forLabel.add(node.productId);
      values.set(label, forLabel);
      valueProducts.set(optionName, values);
    }
  }

  return [...productsByAxis.entries()]
    .map(([optionName, products]) => ({
      optionName,
      values: [...(valueProducts.get(optionName) ?? new Map())]
        .map(([label, ps]) => ({ label, productCount: ps.size }))
        .sort((a, b) => b.productCount - a.productCount || a.label.localeCompare(b.label)),
      coveredCount: products.size,
      missingProductIds: productIds.filter((id) => !products.has(id)),
    }))
    .sort((a, b) => b.coveredCount - a.coveredCount || a.optionName.localeCompare(b.optionName));
}

export interface ProductPairOutcome {
  productId: string;
  deltaCents: number | null;
  reason: AxisMissReason | null;
}

/**
 * Per product, what the chosen from→to pair would cost — or why it doesn't
 * apply. This is what lets the admin see partial coverage before publishing
 * instead of discovering it at the register.
 */
export function pairOutcomes(
  nodes: VariantNode[],
  productIds: string[],
  optionName: string,
  fromValueLabel: string,
  toValueLabel: string,
): ProductPairOutcome[] {
  const targets = upgradeTargets(nodes, optionName, fromValueLabel, toValueLabel);
  const byProduct = new Map<string, VariantNode[]>();
  for (const n of nodes) {
    byProduct.set(n.productId, [...(byProduct.get(n.productId) ?? []), n]);
  }

  return productIds.map((productId) => {
    const own = byProduct.get(productId) ?? [];
    const best = own
      .map((n) => targets.get(n.variantId))
      .filter((t): t is UpgradeTarget => t != null)
      .sort((a, b) => b.deltaCents - a.deltaCents)[0];
    if (best) return { productId, deltaCents: best.deltaCents, reason: null };

    // No delta — say which of the three ways it failed, so the admin can act.
    const hasAxis = own.some((n) => n.options.has(optionName));
    if (!hasAxis) return { productId, deltaCents: null, reason: "no-axis" };
    const from = own.filter((n) => n.options.get(optionName) === fromValueLabel);
    if (from.length === 0) return { productId, deltaCents: null, reason: "no-from" };
    const hasTo = own.some((n) => n.options.get(optionName) === toValueLabel);
    if (!hasTo) return { productId, deltaCents: null, reason: "no-to" };
    return { productId, deltaCents: null, reason: "not-pricier" };
  });
}

/** Wire shape for the admin's axis picker. */
export interface VariantAxesView {
  productCount: number;
  /** Short human name for the scope, for the headline sentence: one or two ref
   *  names, else null so the caller says "productos seleccionados". */
  scopeLabel: string | null;
  unknownRefs: { kind: string; id: string }[];
  axes: {
    optionName: string;
    values: AxisValue[];
    coveredCount: number;
    missing: { id: string; name: string }[];
  }[];
  /** A from→to on the chosen axis that at least one product can satisfy. Lets
   *  the form offer a way out when the admin picks a pair nobody has, instead of
   *  only telling them they're stuck. */
  suggestedPair: { fromValueLabel: string; toValueLabel: string; eligibleCount: number } | null;
  pair: null | {
    optionName: string;
    fromValueLabel: string;
    toValueLabel: string;
    eligibleCount: number;
    minDeltaCents: number;
    maxDeltaCents: number;
    products: {
      id: string;
      name: string;
      productId: string;
      deltaCents: number | null;
      reason: AxisMissReason | null;
    }[];
  };
}

/** The from→to on `optionName` that the most products can satisfy. */
export function bestPair(
  nodes: VariantNode[],
  productIds: string[],
  optionName: string,
): { fromValueLabel: string; toValueLabel: string; eligibleCount: number } | null {
  const axis = axisSummaries(nodes, productIds).find((a) => a.optionName === optionName);
  if (!axis) return null;
  let best: { fromValueLabel: string; toValueLabel: string; eligibleCount: number } | null = null;
  for (const from of axis.values) {
    for (const to of axis.values) {
      if (from.label === to.label) continue;
      const n = pairOutcomes(nodes, productIds, optionName, from.label, to.label).filter(
        (o) => o.deltaCents != null,
      ).length;
      if (n > 0 && (!best || n > best.eligibleCount)) {
        best = { fromValueLabel: from.label, toValueLabel: to.label, eligibleCount: n };
      }
    }
  }
  return best;
}
