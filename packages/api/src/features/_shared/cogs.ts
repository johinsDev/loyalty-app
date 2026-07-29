/**
 * Cost-of-goods for a variant: Σ(quantity × ingredient cost per unit).
 *
 * The formula used to live in three places — the dashboard's SQL subquery, the
 * admin repository's projection, and the recipe editor in the browser — with
 * nothing keeping them in sync. The two JS copies now call this; the SQL one
 * necessarily stays SQL (see `dashboard/repository.ts`, `variant_cogs`), so any
 * change here needs a matching change there.
 *
 * Pure and dependency-free so the browser can import it via the client-safe
 * subpath without dragging `@trpc/server` in.
 */
export interface RecipeCostLine {
  quantity: number;
  costPerUnitCents: number;
}

export function variantCogsCents(lines: readonly RecipeCostLine[]): number {
  return Math.round(lines.reduce((sum, l) => sum + l.quantity * l.costPerUnitCents, 0));
}

/** Whole-percent margin, or null when there's no price to measure against. */
export function marginPct(priceCents: number, costCents: number): number | null {
  if (priceCents <= 0) return null;
  return Math.round(((priceCents - costCents) / priceCents) * 100);
}
