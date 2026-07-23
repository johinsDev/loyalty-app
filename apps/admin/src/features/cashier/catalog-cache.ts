/**
 * Catalog reads (menu list + product detail) are shift-stable, so the register
 * caches them for the whole shift and revalidates in the background. Combined
 * with the prefetch on register mount, product search + the variant picker stay
 * instant even on flaky in-store wifi.
 */
export const CATALOG_STALE_MS = 5 * 60_000;
