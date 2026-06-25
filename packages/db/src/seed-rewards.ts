import { and, eq } from "drizzle-orm";

import { db } from "./client";
import { getPrimaryOrganizationId } from "./primary-org";
import { reward, type RewardInsert, STAMPS_PER_REWARD } from "./schema/loyalty";

/**
 * CLI: seed a spread of rewards into the principal org, covering every case the
 * customer catalog must exercise: points-only, stamps-only, OR / AND costs,
 * tier-gated (locked), curated sections, and once vs unlimited.
 *
 * Usage:
 *   bun run db:seed:rewards
 *
 * Idempotent: a reward is inserted only if one with the same name doesn't exist
 * yet for the org (never deletes, so it's safe to re-run alongside live data).
 * Tier keys mirror points/config.ts (hoja / flor / oro).
 */
type SeedReward = Omit<
  RewardInsert,
  "id" | "organizationId" | "createdAt" | "updatedAt"
>;

const REWARDS: SeedReward[] = [
  {
    // The classic buy-9-get-1: a stamps reward costing a full card.
    name: "Bebida gratis",
    description: "Completa tu tarjeta y reclama cualquier bebida clásica.",
    stampsRequired: STAMPS_PER_REWARD,
    pointsCost: null,
    costMode: "or",
    allowedTiers: null,
    sections: ["destacados"],
    sortOrder: 1,
    limitPerCustomer: "unlimited",
  },
  {
    name: "Topping gratis",
    description: "Un topping a elección en tu próxima bebida.",
    stampsRequired: 6,
    pointsCost: null,
    costMode: "or",
    allowedTiers: null,
    sections: ["novedades"],
    sortOrder: 2,
    limitPerCustomer: "unlimited",
  },
  {
    name: "Upgrade a tamaño L",
    description: "Sube tu bebida a tamaño grande sin costo.",
    stampsRequired: null,
    pointsCost: 120,
    costMode: "or",
    allowedTiers: null,
    sections: [],
    sortOrder: 3,
    limitPerCustomer: "unlimited",
  },
  {
    // OR: pay with points OR stamps, the customer chooses.
    name: "Galleta de regalo",
    description: "Una galleta artesanal. Paga con puntos o sellos.",
    stampsRequired: 5,
    pointsCost: 50,
    costMode: "or",
    allowedTiers: null,
    sections: ["novedades"],
    sortOrder: 4,
    limitPerCustomer: "unlimited",
  },
  {
    // AND: requires both currencies at once.
    name: "Combo aniversario",
    description: "Bebida + postre. Requiere puntos y sellos.",
    stampsRequired: 10,
    pointsCost: 200,
    costMode: "and",
    allowedTiers: null,
    sections: ["destacados"],
    sortOrder: 5,
    limitPerCustomer: "unlimited",
  },
  {
    // Welcome reward — claimable once per customer.
    name: "Bienvenida: primer té gratis",
    description: "Un té de bienvenida, por única vez.",
    stampsRequired: 1,
    pointsCost: null,
    costMode: "or",
    allowedTiers: null,
    sections: ["novedades"],
    sortOrder: 6,
    limitPerCustomer: "once",
  },
  {
    // Tier-locked: only Oro can claim (shows 🔒 to others).
    name: "Bebida Reserva (nivel Oro)",
    description: "Exclusiva para nivel Oro.",
    stampsRequired: null,
    pointsCost: 80,
    costMode: "or",
    allowedTiers: ["oro"],
    sections: ["destacados"],
    sortOrder: 7,
    limitPerCustomer: "unlimited",
  },
  {
    name: "Postre VIP (Flor y Oro)",
    description: "Postre premium para niveles Flor y Oro.",
    stampsRequired: null,
    pointsCost: 150,
    costMode: "or",
    allowedTiers: ["flor", "oro"],
    sections: [],
    sortOrder: 8,
    limitPerCustomer: "unlimited",
  },
];

async function main() {
  const orgId = await getPrimaryOrganizationId();
  if (!orgId) {
    throw new Error(
      "No organization found. Run `bun run db:seed:org` first on a fresh DB.",
    );
  }

  let inserted = 0;
  for (const r of REWARDS) {
    const existing = await db
      .select({ id: reward.id })
      .from(reward)
      .where(and(eq(reward.organizationId, orgId), eq(reward.name, r.name)))
      .limit(1);
    if (existing[0]) continue;
    await db.insert(reward).values({ ...r, organizationId: orgId });
    inserted += 1;
  }

  console.log(
    `✓ Rewards seeded for org ${orgId}: ${inserted} inserted, ${REWARDS.length - inserted} already present.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
