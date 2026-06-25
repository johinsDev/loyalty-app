/**
 * Seeds demo promotions for the primary org (idempotent — clears the org's
 * promos first). Covers every benefit type (nForM / percentage / freeItem /
 * pointsMultiplier / fixed), a couple of conditions (days, first-purchase,
 * min-purchase, max-per-customer), product/category/order scopes, and one EN
 * translation — so the customer home rail + /promos hub + the cashier apply
 * flow all have real data to exercise.
 *
 *   DATABASE_URL='http://localhost:8080' bun run --cwd packages/db src/seed-promos.ts
 *
 * Requires the org + menu to be seeded first (db:seed:org, db:seed:menu).
 */
/* eslint-disable no-await-in-loop, no-console */
import { eq, inArray } from "drizzle-orm";

import { db, getPrimaryOrganizationId } from "./index";
import type { PromoBenefit, PromoConditions, PromoScope } from "./schema";
import { category, member, product, promo, promoTranslation } from "./schema";

const COP = (pesos: number) => pesos * 100; // cents convention (matches seed-menu)

const org = await getPrimaryOrganizationId();
if (!org) throw new Error("no primary organization (run db:seed:org first)");

const [owner] = await db.select().from(member).where(eq(member.organizationId, org)).limit(1);
if (!owner) throw new Error("no member for org (run db:seed:owner first)");
const userId = owner.userId;

// Resolve product + category ids by slug (for scoped promos).
const products = await db
  .select({ id: product.id, slug: product.slug })
  .from(product)
  .where(eq(product.organizationId, org));
const pid = (slug: string): string => {
  const hit = products.find((p) => p.slug === slug);
  if (!hit) throw new Error(`product "${slug}" not found (run db:seed:menu first)`);
  return hit.id;
};
const categories = await db
  .select({ id: category.id, slug: category.slug })
  .from(category)
  .where(eq(category.organizationId, org));
const cid = (slug: string): string => {
  const hit = categories.find((c) => c.slug === slug);
  if (!hit) throw new Error(`category "${slug}" not found`);
  return hit.id;
};

// Clear existing promos for the org (cascade clears translations/notifications).
const existing = await db.select({ id: promo.id }).from(promo).where(eq(promo.organizationId, org));
if (existing.length > 0) {
  await db.delete(promo).where(
    inArray(
      promo.id,
      existing.map((p) => p.id),
    ),
  );
}

type Seed = {
  slug: string;
  name: string;
  short: string;
  long: string;
  badge: string;
  bg: string;
  mainImage?: string;
  category?: string;
  featured?: boolean;
  type: string;
  benefit: PromoBenefit;
  scopeKind: "order" | "products" | "categories";
  scope: PromoScope;
  conditions?: PromoConditions;
  stackable?: boolean;
  en?: { name: string; short: string; long: string; badge: string };
};

const seeds: Seed[] = [
  {
    slug: "2x1-entre-semana",
    name: "2×1 entre semana",
    short: "Lleva dos milk teas y paga uno, de lunes a viernes.",
    long: "<p>De <strong>lunes a viernes</strong>, lleva dos milk teas y paga solo uno. El más barato va por nuestra cuenta. 🧋</p>",
    badge: "2×1",
    bg: "linear-gradient(135deg, #1BAD9D, #0e6f64)",
    category: "destacada",
    featured: true,
    type: "nForM",
    benefit: { buyQty: 2, payQty: 1 },
    scopeKind: "products",
    scope: { productIds: [pid("classic-milk-tea"), pid("taro-milk-tea")] },
    conditions: { daysOfWeek: [1, 2, 3, 4, 5] },
    en: {
      name: "Weekday 2-for-1",
      short: "Buy two milk teas, pay for one — Monday to Friday.",
      long: "<p><strong>Monday to Friday</strong>, buy two milk teas and pay for just one. The cheaper one is on us. 🧋</p>",
      badge: "2-for-1",
    },
  },
  {
    slug: "20-en-frutales",
    name: "20% en frutales",
    short: "Descuento en toda la línea de tés frutales.",
    long: "<p>Disfruta <strong>20% de descuento</strong> en todos nuestros tés frutales. Tope de $8.000 por compra.</p>",
    badge: "20%",
    bg: "linear-gradient(135deg, #f0a868, #e0467c)",
    category: "novedades",
    featured: true,
    type: "percentage",
    benefit: { percent: 20, maxDiscountCents: COP(8000) },
    scopeKind: "categories",
    scope: { categoryIds: [cid("frutales")] },
  },
  {
    slug: "topping-gratis-bienvenida",
    name: "Topping gratis de bienvenida",
    short: "Tu primera compra lleva un Classic Milk Tea de regalo.",
    long: "<p>¡Bienvenido a T4 Lovers! En tu <strong>primera compra</strong> te regalamos un Classic Milk Tea.</p>",
    badge: "Gratis",
    bg: "radial-gradient(at 20% 25%, #7c5cff 0, transparent 50%), #1f2937",
    category: "novedades",
    type: "freeItem",
    benefit: { freeRef: { kind: "product", id: pid("classic-milk-tea") } },
    scopeKind: "products",
    scope: { productIds: [pid("classic-milk-tea")] },
    conditions: { firstPurchaseOnly: true, maxPerCustomer: 1 },
  },
  {
    slug: "doble-puntos-finde",
    name: "Doble puntos el fin de semana",
    short: "Suma el doble de puntos sábados y domingos.",
    long: "<p>Sábados y domingos sumas <strong>el doble de puntos</strong> en toda tu compra.</p>",
    badge: "x2",
    bg: "linear-gradient(135deg, #3b73d6, #1f3a8a)",
    category: "destacada",
    type: "pointsMultiplier",
    benefit: { multiplier: 2 },
    scopeKind: "order",
    scope: {},
    conditions: { daysOfWeek: [0, 6] },
    stackable: true,
  },
  {
    slug: "5000-de-descuento",
    name: "$5.000 de descuento",
    short: "En compras desde $30.000.",
    long: "<p>Lleva <strong>$5.000 de descuento</strong> en compras iguales o mayores a $30.000.</p>",
    badge: "-$5K",
    bg: "linear-gradient(135deg, #0e6f64, #1BAD9D)",
    type: "fixed",
    benefit: { amountCents: COP(5000) },
    scopeKind: "order",
    scope: {},
    conditions: { minPurchaseCents: COP(30000) },
  },
];

const now = new Date();
for (const [i, s] of seeds.entries()) {
  const [row] = await db
    .insert(promo)
    .values({
      organizationId: org,
      createdByUserId: userId,
      status: "published",
      publishedAt: now,
      sortOrder: i,
      slug: s.slug,
      name: s.name,
      type: s.type,
      benefit: s.benefit,
      scopeKind: s.scopeKind,
      scope: s.scope,
      conditions: s.conditions ?? null,
      audienceType: "all",
      stackable: s.stackable ?? false,
      shortDescription: s.short,
      longDescription: s.long,
      badgeLabel: s.badge,
      backgroundCss: s.bg,
      mainImageUrl: s.mainImage ?? null,
      category: s.category ?? null,
      featured: s.featured ?? false,
      seoTitle: `${s.name} · T4 Lovers`,
      seoDescription: s.short,
      ogImageUrl: s.mainImage ?? null,
    })
    .returning({ id: promo.id });

  if (s.en && row) {
    await db.insert(promoTranslation).values({
      promoId: row.id,
      locale: "en",
      name: s.en.name,
      shortDescription: s.en.short,
      longDescription: s.en.long,
      badgeLabel: s.en.badge,
    });
  }
}

console.log(`seeded ${seeds.length} promos`);
process.exit(0);
