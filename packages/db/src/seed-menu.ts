/**
 * Seeds a realistic T4 menu for the primary org (idempotent — clears the org's
 * catalog first). v1 has no admin CRUD, so this is how products get into the DB.
 *
 *   DATABASE_URL='http://localhost:8080' bun run scripts/db/seed-menu.ts
 */
// One-off seed script: sequential awaits (dependent inserts) and console
// progress are intentional.
/* eslint-disable no-await-in-loop, no-console */
import { db, getPrimaryOrganizationId } from "./index";
import {
  category,
  modifierGroup,
  modifierOption,
  product,
  productCategory,
  productImage,
  productOption,
  productOptionValue,
  productVariant,
  productVariantValue,
  section,
  sectionProduct,
} from "./schema";
import { eq, inArray } from "drizzle-orm";

const COP = (pesos: number) => pesos * 100; // priceCents convention
// 1200px so the detail hover-zoom stays crisp (in prod, R2 originals + the
// Cloudflare image transform handle this; picsum is the dev/demo stand-in).
const img = (seed: string) => `https://picsum.photos/seed/${seed}/1200/1200`;

const org = await getPrimaryOrganizationId();
if (!org) throw new Error("no primary organization");

// ---- clean (idempotent) ----------------------------------------------------
const existing = await db
  .select({ id: product.id })
  .from(product)
  .where(eq(product.organizationId, org));
const pids = existing.map((p) => p.id);
if (pids.length) {
  await db.delete(productImage).where(inArray(productImage.productId, pids));
  await db.delete(productCategory).where(inArray(productCategory.productId, pids));
  await db.delete(sectionProduct).where(inArray(sectionProduct.productId, pids));
  // option values / variant values cascade via FKs on delete of their parents
  const opts = await db
    .select({ id: productOption.id })
    .from(productOption)
    .where(inArray(productOption.productId, pids));
  if (opts.length)
    await db.delete(productOptionValue).where(
      inArray(productOptionValue.optionId, opts.map((o) => o.id)),
    );
  await db.delete(productOption).where(inArray(productOption.productId, pids));
  const vars = await db
    .select({ id: productVariant.id })
    .from(productVariant)
    .where(inArray(productVariant.productId, pids));
  if (vars.length)
    await db.delete(productVariantValue).where(
      inArray(productVariantValue.variantId, vars.map((v) => v.id)),
    );
  await db.delete(productVariant).where(inArray(productVariant.productId, pids));
  const groups = await db
    .select({ id: modifierGroup.id })
    .from(modifierGroup)
    .where(inArray(modifierGroup.productId, pids));
  if (groups.length)
    await db.delete(modifierOption).where(
      inArray(modifierOption.groupId, groups.map((g) => g.id)),
    );
  await db.delete(modifierGroup).where(inArray(modifierGroup.productId, pids));
  await db.delete(product).where(inArray(product.id, pids));
}
await db.delete(section).where(eq(section.organizationId, org));
await db.delete(category).where(eq(category.organizationId, org));

// ---- categories ------------------------------------------------------------
const cats = [
  { slug: "milk-tea", name: "Milk Tea" },
  { slug: "matcha", name: "Matcha" },
  { slug: "frutales", name: "Frutales" },
  { slug: "especiales", name: "Especiales" },
];
const catIds: Record<string, string> = {};
for (const [i, c] of cats.entries()) {
  const [row] = await db
    .insert(category)
    .values({ organizationId: org, slug: c.slug, name: c.name, sortOrder: i })
    .returning({ id: category.id });
  catIds[c.slug] = row!.id;
}

// ---- products --------------------------------------------------------------
type Seed = {
  slug: string;
  name: string;
  desc: string;
  price: number; // COP
  cat: string;
  images?: string[];
  sizes?: boolean; // adds Tamaño M/G (+800 G)
  variantImages?: { m?: string; g?: string };
  toppings?: boolean;
};

const seeds: Seed[] = [
  {
    slug: "brown-sugar-boba",
    name: "Brown Sugar Boba",
    desc: "<p>Azúcar morena caramelizada, boba fresca y leche entera.</p>",
    price: 16500,
    cat: "milk-tea",
    images: [img("bsb1"), img("bsb2"), img("bsb3")],
    sizes: true,
    variantImages: { m: img("bsb-m"), g: img("bsb-g") },
    toppings: true,
  },
  { slug: "taro-milk-tea", name: "Taro Milk Tea", desc: "<p>Taro cremoso con perlas.</p>", price: 15500, cat: "milk-tea", images: [img("taro1"), img("taro2")], sizes: true, toppings: true },
  { slug: "classic-milk-tea", name: "Classic Milk Tea", desc: "<p>El de siempre, con boba.</p>", price: 13500, cat: "milk-tea", images: [img("classic1")], sizes: true, toppings: true },
  { slug: "iced-matcha-latte", name: "Iced Matcha Latte", desc: "<p>Matcha ceremonial, leche de avena.</p>", price: 15000, cat: "matcha", images: [img("matcha1"), img("matcha2")], sizes: true, toppings: true },
  { slug: "matcha-strawberry", name: "Matcha Strawberry", desc: "<p>Matcha + nube de fresa.</p>", price: 17000, cat: "matcha", images: [img("matchastraw1")], sizes: true },
  { slug: "peach-oolong", name: "Peach Oolong", desc: "<p>Oolong con durazno, ligero y floral.</p>", price: 14500, cat: "frutales", images: [img("peach1")], toppings: true },
  { slug: "strawberry-cloud", name: "Strawberry Cloud", desc: "<p>Fresa natural con crema.</p>", price: 16000, cat: "frutales", images: [img("straw1"), img("straw2")] },
  { slug: "mango-tango", name: "Mango Tango", desc: "<p>Mango fresco, té verde.</p>", price: 15500, cat: "frutales", images: [img("mango1")] },
  { slug: "spring-drop", name: "Spring Drop", desc: "<p>Peach oolong + strawberry cloud. Edición de temporada.</p>", price: 18000, cat: "especiales", images: [img("spring1"), img("spring2")], sizes: true, toppings: true },
  { slug: "dragon-fruit-fizz", name: "Dragon Fruit Fizz", desc: "<p>Pitaya con soda.</p>", price: 16500, cat: "especiales", images: [img("dragon1")] },
  {
    slug: "studio-showcase",
    name: "Studio Showcase",
    desc: "<p>Bebida <strong>demo</strong> con muchas fotos para probar la galería:</p><ul><li>Lightbox a pantalla completa</li><li>Zoom de lente al pasar el mouse</li><li>Miniaturas con <em>+N</em></li></ul><p>Pruébalo en <strong>desktop</strong>.</p>",
    price: 19000,
    cat: "especiales",
    images: [
      img("gallery1"), img("gallery2"), img("gallery3"), img("gallery4"),
      img("gallery5"), img("gallery6"), img("gallery7"), img("gallery8"),
      img("gallery9"), img("gallery10"), img("gallery11"),
    ],
    sizes: true,
    toppings: true,
  },
];

const productIdBySlug: Record<string, string> = {};
for (const [i, s] of seeds.entries()) {
  const [p] = await db
    .insert(product)
    .values({
      organizationId: org,
      slug: s.slug,
      name: s.name,
      description: s.desc,
      basePriceCents: COP(s.price),
      currency: "COP",
      status: "active",
      sortOrder: i,
      seoTitle: `${s.name} · T4 Lovers`,
      seoDescription: s.desc.replace(/<[^>]+>/g, "").slice(0, 150),
      ogImageUrl: s.images?.[0] ?? null,
    })
    .returning({ id: product.id });
  const pid = p!.id;
  productIdBySlug[s.slug] = pid;

  await db.insert(productCategory).values({ productId: pid, categoryId: catIds[s.cat]! });

  // product-level images
  for (const [j, url] of (s.images ?? []).entries()) {
    await db.insert(productImage).values({ productId: pid, url, sortOrder: j });
  }

  // size option → variants
  if (s.sizes) {
    const [opt] = await db
      .insert(productOption)
      .values({ productId: pid, name: "Tamaño", sortOrder: 0 })
      .returning({ id: productOption.id });
    const [valM] = await db
      .insert(productOptionValue)
      .values({ optionId: opt!.id, label: "Mediano", sortOrder: 0 })
      .returning({ id: productOptionValue.id });
    const [valG] = await db
      .insert(productOptionValue)
      .values({ optionId: opt!.id, label: "Grande", sortOrder: 1 })
      .returning({ id: productOptionValue.id });

    const [varM] = await db
      .insert(productVariant)
      .values({ productId: pid, priceCents: COP(s.price), isDefault: true, sortOrder: 0 })
      .returning({ id: productVariant.id });
    const [varG] = await db
      .insert(productVariant)
      .values({ productId: pid, priceCents: COP(s.price + 2000), isDefault: false, sortOrder: 1 })
      .returning({ id: productVariant.id });
    await db.insert(productVariantValue).values([
      { variantId: varM!.id, optionValueId: valM!.id },
      { variantId: varG!.id, optionValueId: valG!.id },
    ]);

    if (s.variantImages?.m)
      await db.insert(productImage).values({ productId: pid, variantId: varM!.id, url: s.variantImages.m, sortOrder: 0 });
    if (s.variantImages?.g)
      await db.insert(productImage).values({ productId: pid, variantId: varG!.id, url: s.variantImages.g, sortOrder: 0 });
  }

  // modifier groups (toppings + sugar) on drinks
  if (s.toppings) {
    const [tg] = await db
      .insert(modifierGroup)
      .values({ productId: pid, name: "Toppings", selectionType: "multi", minSelect: 0, maxSelect: 3, required: false, sortOrder: 0 })
      .returning({ id: modifierGroup.id });
    await db.insert(modifierOption).values([
      { groupId: tg!.id, name: "Perlas", priceDeltaCents: COP(2000), sortOrder: 0 },
      { groupId: tg!.id, name: "Pudín", priceDeltaCents: COP(2500), sortOrder: 1 },
      { groupId: tg!.id, name: "Jelly", priceDeltaCents: COP(2000), sortOrder: 2 },
    ]);
    const [sg] = await db
      .insert(modifierGroup)
      .values({ productId: pid, name: "Azúcar", selectionType: "single", minSelect: 1, maxSelect: 1, required: true, sortOrder: 1 })
      .returning({ id: modifierGroup.id });
    await db.insert(modifierOption).values([
      { groupId: sg!.id, name: "0%", priceDeltaCents: 0, sortOrder: 0 },
      { groupId: sg!.id, name: "50%", priceDeltaCents: 0, sortOrder: 1 },
      { groupId: sg!.id, name: "100%", priceDeltaCents: 0, sortOrder: 2 },
    ]);
  }
}

// ---- sections + featured banner -------------------------------------------
const [banner] = await db
  .insert(section)
  .values({
    organizationId: org,
    slug: "temporada",
    name: "Temporada",
    kind: "banner",
    placement: "menu",
    sortOrder: 0,
    bannerTitle: "Llegó el Spring drop",
    bannerSubtitle: "Peach oolong + strawberry cloud, ya en tienda 🌸",
    bannerImageUrl: img("springbanner"),
    bannerHref: "/product/spring-drop",
  })
  .returning({ id: section.id });
void banner;

// Destacado: a single featured product rendered as a big card.
const [featured] = await db
  .insert(section)
  .values({
    organizationId: org,
    slug: "destacado",
    name: "Destacado",
    kind: "featured",
    placement: "menu",
    sortOrder: 1,
  })
  .returning({ id: section.id });
await db.insert(sectionProduct).values({
  sectionId: featured!.id,
  productId: productIdBySlug["iced-matcha-latte"]!,
  sortOrder: 0,
});

const carousels = [
  { slug: "mas-pedidos", name: "Más pedidos", products: ["studio-showcase", "brown-sugar-boba", "taro-milk-tea", "classic-milk-tea", "iced-matcha-latte"] },
  { slug: "frutales", name: "Frutales del momento", products: ["peach-oolong", "strawberry-cloud", "mango-tango", "dragon-fruit-fizz"] },
];
for (const [i, c] of carousels.entries()) {
  const [sec] = await db
    .insert(section)
    .values({ organizationId: org, slug: c.slug, name: c.name, kind: "carousel", placement: "menu", sortOrder: i + 2 })
    .returning({ id: section.id });
  for (const [j, slug] of c.products.entries()) {
    await db.insert(sectionProduct).values({ sectionId: sec!.id, productId: productIdBySlug[slug]!, sortOrder: j });
  }
}

console.log(`seeded ${seeds.length} products, ${cats.length} categories, ${carousels.length} carousels + 1 banner`);
process.exit(0);
