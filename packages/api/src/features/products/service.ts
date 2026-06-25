import { CacheManager } from "@loyalty/cache";

import type { ProductsRepository } from "./repository";
import type { ListInput, MenuCard, MenuList, ProductDetail, SectionView } from "./schemas";

// Public menu reads are cached (the catalog rarely changes). Module singleton so
// it survives across requests in a warm Worker isolate. Memory by default;
// `CACHE_PROVIDER`/Upstash can back it in prod. Favorites are per-user → never cached.
const TTL_SECONDS = 600;
const cache = new CacheManager({
  default: "memory",
  stores: { memory: { provider: "memory" } },
});

/**
 * Menu business logic. Wraps the repo's public reads in a read-through cache and
 * leaves an `invalidate(orgId)` seam for when the admin CRUD lands (it'll call it
 * on edit). Earn previews are computed in the repo via `earnFor`.
 */
export class MenuService {
  constructor(private readonly repo: ProductsRepository) {}

  list(orgId: string, input: ListInput): Promise<MenuList> {
    const key = `menu:${orgId}:list:${input.categorySlug ?? ""}:${input.sectionSlug ?? ""}:${input.search ?? ""}:${input.cursor ?? ""}:${input.pageSize}`;
    return cache.getOrSet(key, () => this.repo.listProducts({ orgId, ...input }), TTL_SECONDS);
  }

  productBySlug(orgId: string, slug: string): Promise<ProductDetail | null> {
    return cache.getOrSet(
      `menu:${orgId}:product:${slug}`,
      () => this.repo.productBySlug(orgId, slug),
      TTL_SECONDS,
    );
  }

  sections(orgId: string, placement: string): Promise<SectionView[]> {
    return cache.getOrSet(
      `menu:${orgId}:sections:${placement}`,
      () => this.repo.sections(orgId, placement),
      TTL_SECONDS,
    );
  }

  categories(orgId: string): Promise<{ slug: string; name: string }[]> {
    return cache.getOrSet(
      `menu:${orgId}:categories`,
      () => this.repo.categories(orgId),
      TTL_SECONDS,
    );
  }

  myFavoriteIds(orgId: string, customerId: string): Promise<string[]> {
    return this.repo.favoriteProductIds(orgId, customerId);
  }

  myFavorites(orgId: string, customerId: string): Promise<MenuCard[]> {
    return this.repo.favoriteProducts(orgId, customerId);
  }

  toggleFavorite(orgId: string, customerId: string, productId: string): Promise<boolean> {
    return this.repo.toggleFavorite({ orgId, customerId, productId });
  }

  /** Seam for the admin CRUD: drop cached sections on edit. List/product entries
   *  expire via TTL (their keys vary by cursor/slug); the admin slice will wire
   *  precise invalidation. */
  async invalidate(orgId: string): Promise<void> {
    await cache.deleteMany([
      `menu:${orgId}:sections:menu`,
      `menu:${orgId}:sections:home`,
      `menu:${orgId}:sections:both`,
    ]);
  }
}
