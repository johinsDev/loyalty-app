import type { Cart } from "./engine";
import type { PromoRepository } from "./repository";

/**
 * Stitch category ids + modifier deltas into a cart so the pure engine can
 * match category-scoped rules and price modifier units without extra lookups.
 * Shared so the checkout evaluates rewards and promos against the identical
 * enriched cart (no drift).
 */
export async function enrichCart(
  repo: Pick<PromoRepository, "productCategories" | "modifierOptionDeltas">,
  cart: Cart,
): Promise<Cart> {
  const modifierIds = [...new Set(cart.lines.flatMap((l) => l.modifierOptionIds ?? []))];
  const [cats, deltas] = await Promise.all([
    repo.productCategories(cart.lines.map((l) => l.productId)),
    repo.modifierOptionDeltas(modifierIds),
  ]);
  return {
    currency: cart.currency,
    lines: cart.lines.map((l) => ({
      ...l,
      categoryIds: cats.get(l.productId) ?? [],
      modifierOptions: (l.modifierOptionIds ?? []).map((id) => ({
        id,
        priceDeltaCents: deltas.get(id) ?? 0,
      })),
    })),
  };
}
