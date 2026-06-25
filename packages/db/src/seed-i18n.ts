/**
 * Seeds the locale/currency demo on top of the menu + banners seeds: enables
 * es/en + COP/USD for the org and adds English translations + USD prices to a
 * few products/banners (leaving some without, to show the fallback to default).
 *
 *   DATABASE_URL='http://localhost:8080' bun run --cwd packages/db src/seed-i18n.ts
 */
/* eslint-disable no-await-in-loop, no-console */
import { db, getPrimaryOrganizationId } from "./index";
import {
  banner,
  bannerTranslation,
  category,
  categoryTranslation,
  modifierOption,
  modifierOptionPrice,
  organizationSettings,
  product,
  productPrice,
  productTranslation,
  productVariant,
  productVariantPrice,
} from "./schema";
import { eq, inArray } from "drizzle-orm";

const org = await getPrimaryOrganizationId();
if (!org) throw new Error("no primary organization");

// ── Org settings: enable both locales + currencies (default es / COP) ────────
await db
  .insert(organizationSettings)
  .values({
    organizationId: org,
    defaultLocale: "es",
    enabledLocales: ["es", "en"],
    defaultCurrency: "COP",
    enabledCurrencies: ["COP", "USD"],
  })
  .onConflictDoUpdate({
    target: organizationSettings.organizationId,
    set: {
      defaultLocale: "es",
      enabledLocales: ["es", "en"],
      defaultCurrency: "COP",
      enabledCurrencies: ["COP", "USD"],
      updatedAt: new Date(),
    },
  });

// Rough COP→USD for the demo (no FX; admin would enter real prices).
const usd = (cop: number) => Math.round((cop / 100 / 4000) * 100); // cents

// ── Products: EN translation + USD prices for a subset ───────────────────────
// Leave "taro-milk-tea" untouched to demo the fallback (stays es + COP).
const EN: Record<string, { name: string; description: string }> = {
  "iced-matcha-latte": { name: "Iced Matcha Latte", description: "<p>Ceremonial matcha, oat milk.</p>" },
  "brown-sugar-boba": { name: "Brown Sugar Boba", description: "<p>Caramelized brown sugar, fresh boba, whole milk.</p>" },
  "classic-milk-tea": { name: "Classic Milk Tea", description: "<p>The classic, with boba.</p>" },
};

const prods = await db
  .select({ id: product.id, slug: product.slug, base: product.basePriceCents })
  .from(product)
  .where(eq(product.organizationId, org));
const pidBySlug = new Map(prods.map((p) => [p.slug, p]));
const targetIds = Object.keys(EN)
  .map((s) => pidBySlug.get(s)?.id)
  .filter((x): x is string => Boolean(x));

if (targetIds.length) {
  await db.delete(productTranslation).where(inArray(productTranslation.productId, targetIds));
  await db.delete(productPrice).where(inArray(productPrice.productId, targetIds));
  for (const slug of Object.keys(EN)) {
    const p = pidBySlug.get(slug);
    if (!p) continue;
    await db.insert(productTranslation).values({ productId: p.id, locale: "en", ...EN[slug]! });
    await db.insert(productPrice).values({ productId: p.id, currency: "USD", amountCents: usd(p.base) });

    // Variant + modifier USD prices for a coherent USD total.
    const variants = await db
      .select({ id: productVariant.id, price: productVariant.priceCents })
      .from(productVariant)
      .where(eq(productVariant.productId, p.id));
    if (variants.length) {
      await db.delete(productVariantPrice).where(
        inArray(productVariantPrice.variantId, variants.map((v) => v.id)),
      );
      for (const v of variants)
        await db.insert(productVariantPrice).values({ variantId: v.id, currency: "USD", amountCents: usd(v.price) });
    }
  }
  // Modifier option USD deltas (org-wide for the seeded toppings, skip zero deltas).
  const opts = await db
    .select({ id: modifierOption.id, delta: modifierOption.priceDeltaCents })
    .from(modifierOption);
  const paidOpts = opts.filter((o) => o.delta > 0);
  if (paidOpts.length) {
    await db.delete(modifierOptionPrice).where(
      inArray(modifierOptionPrice.modifierOptionId, paidOpts.map((o) => o.id)),
    );
    for (const o of paidOpts)
      await db.insert(modifierOptionPrice).values({ modifierOptionId: o.id, currency: "USD", amountCents: usd(o.delta) });
  }
}

// ── Categories: EN names ─────────────────────────────────────────────────────
const CAT_EN: Record<string, string> = {
  "milk-tea": "Milk Tea",
  matcha: "Matcha",
  frutales: "Fruity",
  especiales: "Specials",
};
const cats = await db
  .select({ id: category.id, slug: category.slug })
  .from(category)
  .where(eq(category.organizationId, org));
if (cats.length) {
  await db.delete(categoryTranslation).where(inArray(categoryTranslation.categoryId, cats.map((c) => c.id)));
  for (const c of cats) {
    const name = CAT_EN[c.slug];
    if (name) await db.insert(categoryTranslation).values({ categoryId: c.id, locale: "en", name });
  }
}

// ── Banners: EN translation for a subset (leave one es-only) ──────────────────
const BANNER_EN: Record<string, { name: string; shortDescription: string; longDescription: string }> = {
  "spring-drop": {
    name: "The Spring Drop is here",
    shortDescription: "Peach oolong + strawberry cloud, in store now 🌸",
    longDescription: "<p>The seasonal edition is here. <strong>Peach oolong</strong> and <strong>strawberry cloud</strong> for a limited time.</p>",
  },
  "nuevos-horarios": {
    name: "New hours",
    shortDescription: "Now open until 10pm Thu–Sat.",
    longDescription: "<p>We extended our hours:</p><ul><li>Mon–Wed: 11am – 8pm</li><li>Thu–Sat: 11am – 10pm</li><li>Sun: 12pm – 7pm</li></ul>",
  },
};
const banners = await db
  .select({ id: banner.id, slug: banner.slug })
  .from(banner)
  .where(eq(banner.organizationId, org));
const bidBySlug = new Map(banners.map((b) => [b.slug, b.id]));
const bTargets = Object.keys(BANNER_EN)
  .map((s) => bidBySlug.get(s))
  .filter((x): x is string => Boolean(x));
if (bTargets.length) {
  await db.delete(bannerTranslation).where(inArray(bannerTranslation.bannerId, bTargets));
  for (const slug of Object.keys(BANNER_EN)) {
    const id = bidBySlug.get(slug);
    if (id) await db.insert(bannerTranslation).values({ bannerId: id, locale: "en", ...BANNER_EN[slug]! });
  }
}

console.log("seeded org localization (es/en, COP/USD) + EN translations + USD prices");
process.exit(0);
