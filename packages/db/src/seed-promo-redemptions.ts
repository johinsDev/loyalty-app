/**
 * Seeds demo promo redemptions for the primary org (idempotent — clears prior
 * `demo-*` rows first) so the admin promo analytics — the Analytics section,
 * the dashboard widget, and the per-promo detail block — have realistic
 * movement over the last 30 days. Each redemption is attached to a distinct
 * existing purchase so revenue attribution isn't double-counted; volumes and
 * weekday/weekend bias roughly follow each promo's schedule.
 *
 *   DATABASE_URL='http://localhost:8080' bun run --cwd packages/db src/seed-promo-redemptions.ts
 *
 * Requires the promos + some purchases to exist (db:seed:promos, plus purchases
 * from real usage or another seed).
 */
/* eslint-disable no-await-in-loop, no-console */
import { eq, like } from "drizzle-orm";

import { db, getPrimaryOrganizationId } from "./index";
import { customer, promo, promoRedemption, purchase } from "./schema";

const DAY_MS = 86_400_000;

const org = await getPrimaryOrganizationId();
if (!org) throw new Error("no primary organization (run db:seed:org first)");

const customers = await db
  .select({ id: customer.id })
  .from(customer)
  .where(eq(customer.organizationId, org));
if (customers.length === 0) throw new Error("no customers to attribute redemptions to");

const purchases = await db
  .select({ id: purchase.id, priceCents: purchase.priceCents })
  .from(purchase)
  .where(eq(purchase.organizationId, org));
if (purchases.length === 0) throw new Error("no purchases — seed some purchases first");
// Prefer higher-value tickets so demo revenue reads sensibly against the discount.
purchases.sort((a, b) => b.priceCents - a.priceCents);

const promos = await db
  .select({ id: promo.id, slug: promo.slug })
  .from(promo)
  .where(eq(promo.organizationId, org));
const bySlug = (slug: string) => promos.find((p) => p.slug === slug)?.id;

// Deterministic PRNG so re-running produces the same demo distribution.
let seed = 1337;
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)]!;

type Weekday = "week" | "weekend" | "any";
type Plan = { slug: string; count: number; discount: [number, number]; bias: Weekday };

// discount ranges in cents (COP). pointsMultiplier promos give 0 discount.
const PLANS: Plan[] = [
  { slug: "2x1-entre-semana", count: 14, discount: [1_300_000, 1_650_000], bias: "week" },
  { slug: "segundo-al-50", count: 9, discount: [700_000, 825_000], bias: "any" },
  { slug: "20-en-frutales", count: 8, discount: [250_000, 600_000], bias: "any" },
  { slug: "5000-de-descuento", count: 6, discount: [500_000, 500_000], bias: "any" },
  { slug: "doble-puntos-finde", count: 5, discount: [0, 0], bias: "weekend" },
  { slug: "milk-tea-bienvenida", count: 2, discount: [1_350_000, 1_350_000], bias: "any" },
];

/** A timestamp within the last 30 days matching the weekday bias. */
function pickDate(bias: Weekday): Date {
  for (let attempt = 0; attempt < 20; attempt++) {
    const daysAgo = Math.floor(rand() * 30);
    const d = new Date(Date.now() - daysAgo * DAY_MS - Math.floor(rand() * DAY_MS));
    const dow = d.getDay(); // 0 Sun … 6 Sat
    const weekend = dow === 0 || dow === 6;
    if (bias === "any" || (bias === "weekend") === weekend) return d;
  }
  return new Date(Date.now() - Math.floor(rand() * 30) * DAY_MS);
}

await db.delete(promoRedemption).where(like(promoRedemption.id, "demo-%"));

// Distinct purchase per redemption (from the higher-value tickets first) so
// revenue isn't double-counted and stays above the discount.
let purchaseIdx = 0;
let n = 0;

for (const plan of PLANS) {
  const promoId = bySlug(plan.slug);
  if (!promoId) continue;
  for (let i = 0; i < plan.count && purchaseIdx < purchases.length; i++) {
    const ticket = purchases[purchaseIdx++]!;
    const [lo, hi] = plan.discount;
    const planned = lo === hi ? lo : lo + Math.floor(rand() * (hi - lo));
    // Never give away more than ~80% of the ticket (keeps the demo believable).
    const discountCents = Math.min(planned, Math.round(ticket.priceCents * 0.8));
    await db.insert(promoRedemption).values({
      id: `demo-${n++}`,
      promoId,
      customerId: pick(customers).id,
      purchaseId: ticket.id,
      discountCents,
      currency: "COP",
      appliedAt: pickDate(plan.bias),
    });
  }
}

console.log(`seeded ${n} demo promo redemptions (wipe with: delete where id like 'demo-%')`);
process.exit(0);
