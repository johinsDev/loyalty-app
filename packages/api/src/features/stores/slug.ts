/** URL-safe store slugs for the admin's `/[store]/…` scope. */

/** Slugify a store name: lowercase, strip accents, non-alphanumerics → dashes.
 *  Falls back to "tienda" when the name has no usable characters. */
export function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return base || "tienda";
}

/** A slug not already in `taken` — appends -2, -3, … on collision. `taken`
 *  should hold the org's existing slugs (case-insensitive). */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
