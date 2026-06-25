/**
 * Seeds a few demo banners for the primary org (idempotent — clears the org's
 * banners first). v1 has the admin CRUD, but this gives the customer home rail
 * something to show immediately + covers the CTA / non-CTA / pattern variants.
 *
 *   DATABASE_URL='http://localhost:8080' bun run --cwd packages/db src/seed-banners.ts
 */
/* eslint-disable no-await-in-loop, no-console */
import { db, getPrimaryOrganizationId } from "./index";
import { banner } from "./schema";
import { eq } from "drizzle-orm";

const img = (seed: string) => `https://picsum.photos/seed/${seed}/1200/1200`;

const org = await getPrimaryOrganizationId();
if (!org) throw new Error("no primary organization");

await db.delete(banner).where(eq(banner.organizationId, org));

type Seed = {
  slug: string;
  name: string;
  short: string;
  long: string;
  bg: string;
  mainImage?: string;
  cta?: { label: string; href: string; kind: "internal" | "external" };
};

const seeds: Seed[] = [
  {
    slug: "spring-drop",
    name: "Llegó el Spring Drop",
    short: "Peach oolong + strawberry cloud, ya en tienda 🌸",
    long: "<p>La edición de temporada llegó. <strong>Peach oolong</strong> y <strong>strawberry cloud</strong> por tiempo limitado.</p>",
    bg: "linear-gradient(135deg, #f0a868, #e0467c)",
    mainImage: img("springdrop"),
    cta: { label: "Ver menú", href: "/menu", kind: "internal" },
  },
  {
    slug: "nuevos-horarios",
    name: "Nuevos horarios",
    short: "Ahora abrimos hasta las 10 pm de jueves a sábado.",
    long: "<p>Ampliamos nuestros horarios:</p><ul><li>Lun–Mié: 11am – 8pm</li><li>Jue–Sáb: 11am – 10pm</li><li>Dom: 12pm – 7pm</li></ul><p>¡Te esperamos! 🧋</p>",
    bg: "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px) 0 0/20px 20px, linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px) 0 0/20px 20px, linear-gradient(135deg, #3b73d6, #1f3a8a)",
  },
  {
    slug: "siguenos-instagram",
    name: "Síguenos en Instagram",
    short: "Sorteos y novedades cada semana 📸",
    long: "<p>Seguinos para enterarte de los lanzamientos y participar en los sorteos.</p>",
    bg: "radial-gradient(at 18% 22%, #f0a868 0, transparent 45%), radial-gradient(at 82% 28%, #e0467c 0, transparent 45%), radial-gradient(at 50% 82%, #7c5cff 0, transparent 45%), #1f2937",
    cta: { label: "Seguir", href: "https://instagram.com", kind: "external" },
  },
];

for (const [i, s] of seeds.entries()) {
  await db.insert(banner).values({
    organizationId: org,
    slug: s.slug,
    name: s.name,
    status: "published",
    sortOrder: i,
    shortDescription: s.short,
    longDescription: s.long,
    backgroundCss: s.bg,
    mainImageUrl: s.mainImage ?? null,
    ctaLabel: s.cta?.label ?? null,
    ctaHref: s.cta?.href ?? null,
    ctaKind: s.cta?.kind ?? null,
    seoTitle: `${s.name} · T4 Lovers`,
    seoDescription: s.short,
    ogImageUrl: s.mainImage ?? null,
  });
}

console.log(`seeded ${seeds.length} banners`);
process.exit(0);
