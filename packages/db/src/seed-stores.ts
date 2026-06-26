/**
 * Seeds a couple of demo stores + light branding for the primary org
 * (idempotent — clears the org's stores first). Gives the customer /store page +
 * switcher and the brand surfaces something to show before the admin authors the
 * real data.
 *
 *   DATABASE_URL='http://localhost:8080' bun run --cwd packages/db src/seed-stores.ts
 */
/* eslint-disable no-await-in-loop, no-console */
import { eq } from "drizzle-orm";

import { db, getPrimaryOrganizationId } from "./index";
import type { StoreHours } from "./schema";
import { organizationSettings, store } from "./schema";

const org = await getPrimaryOrganizationId();
if (!org) throw new Error("no primary organization (run db:seed:org first)");

const HOURS: StoreHours = Object.fromEntries(
  Array.from({ length: 7 }, (_, d) => [d, { open: "10:00", close: "21:00", closed: false }]),
);

await db.delete(store).where(eq(store.organizationId, org));

const seeds = [
  {
    name: "T4 Centro",
    address: "Cra 7 #45-12, Bogotá",
    lat: 4.628,
    lng: -74.064,
    phone: "+5716000001",
    isPrimary: true,
  },
  {
    name: "T4 Colina",
    address: "Cl 138 #58-90, Bogotá",
    lat: 4.726,
    lng: -74.06,
    phone: "+5716000002",
    isPrimary: false,
  },
];

for (const [i, s] of seeds.entries()) {
  await db.insert(store).values({
    organizationId: org,
    name: s.name,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    phone: s.phone,
    hours: HOURS,
    timezone: "America/Bogota",
    isPrimary: s.isPrimary,
    isPublished: true,
    sortOrder: i,
  });
}

// Light branding (description + social) — leaves name/logo/color to the admin.
await db
  .insert(organizationSettings)
  .values({
    organizationId: org,
    description: "Bubble tea & más, hecho con cariño.",
    socialLinks: { instagram: "https://instagram.com/t4lovers", whatsapp: "+5716000001" },
  })
  .onConflictDoUpdate({
    target: organizationSettings.organizationId,
    set: {
      description: "Bubble tea & más, hecho con cariño.",
      socialLinks: { instagram: "https://instagram.com/t4lovers", whatsapp: "+5716000001" },
      updatedAt: new Date(),
    },
  });

console.log(`seeded ${seeds.length} stores + branding`);
process.exit(0);
