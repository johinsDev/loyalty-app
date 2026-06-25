import { CacheManager } from "@loyalty/cache";

import {
  SUPPORTED_CURRENCIES,
  SUPPORTED_LOCALES,
  type LocaleContext,
} from "../_shared/localize";
import type { ProductsRepository } from "./repository";
import type { ListInput, MenuCard, MenuList, ProductDetail, SectionView } from "./schemas";

// Public menu reads are cached (the catalog rarely changes). Module singleton so
// it survives across requests in a warm Worker isolate. Keys include the active
// locale + currency. Favorites are per-user → never cached.
const TTL_SECONDS = 600;
const cache = new CacheManager({
  default: "memory",
  stores: { memory: { provider: "memory" } },
});

const lcKey = (lc: LocaleContext) => `${lc.locale}:${lc.currency}`;

/**
 * Menu business logic. Wraps the repo's public reads in a read-through cache
 * (per locale+currency) and leaves an `invalidate(orgId)` seam for the admin
 * CRUD. Content + price are resolved in the repo via the active LocaleContext.
 */
export class MenuService {
  constructor(private readonly repo: ProductsRepository) {}

  list(orgId: string, input: ListInput, lc: LocaleContext): Promise<MenuList> {
    const key = `menu:${orgId}:list:${input.categorySlug ?? ""}:${input.sectionSlug ?? ""}:${input.search ?? ""}:${input.cursor ?? ""}:${input.pageSize}:${lcKey(lc)}`;
    return cache.getOrSet(key, () => this.repo.listProducts({ orgId, ...input, ctx: lc }), TTL_SECONDS);
  }

  productBySlug(orgId: string, slug: string, lc: LocaleContext): Promise<ProductDetail | null> {
    return cache.getOrSet(
      `menu:${orgId}:product:${slug}:${lcKey(lc)}`,
      () => this.repo.productBySlug(orgId, slug, lc),
      TTL_SECONDS,
    );
  }

  sections(orgId: string, placement: string, lc: LocaleContext): Promise<SectionView[]> {
    return cache.getOrSet(
      `menu:${orgId}:sections:${placement}:${lcKey(lc)}`,
      () => this.repo.sections(orgId, placement, lc),
      TTL_SECONDS,
    );
  }

  categories(orgId: string, lc: LocaleContext): Promise<{ slug: string; name: string }[]> {
    return cache.getOrSet(
      `menu:${orgId}:categories:${lc.locale}`,
      () => this.repo.categories(orgId, lc),
      TTL_SECONDS,
    );
  }

  myFavoriteIds(orgId: string, customerId: string): Promise<string[]> {
    return this.repo.favoriteProductIds(orgId, customerId);
  }

  myFavorites(orgId: string, customerId: string, lc: LocaleContext): Promise<MenuCard[]> {
    return this.repo.favoriteProducts(orgId, customerId, lc);
  }

  toggleFavorite(orgId: string, customerId: string, productId: string): Promise<boolean> {
    return this.repo.toggleFavorite({ orgId, customerId, productId });
  }

  /** Seam for the admin CRUD: drop cached sections + categories (all
   *  locale/currency combos) on edit. List/product entries expire via TTL. */
  async invalidate(orgId: string): Promise<void> {
    const keys: string[] = [];
    for (const locale of SUPPORTED_LOCALES) {
      keys.push(`menu:${orgId}:categories:${locale}`);
      for (const currency of SUPPORTED_CURRENCIES) {
        const lc = `${locale}:${currency}`;
        keys.push(
          `menu:${orgId}:sections:menu:${lc}`,
          `menu:${orgId}:sections:home:${lc}`,
          `menu:${orgId}:sections:both:${lc}`,
        );
      }
    }
    await cache.deleteMany(keys);
  }
}
