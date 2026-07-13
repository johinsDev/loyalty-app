import type { db as Db } from "@loyalty/db";
import {
  organization,
  organizationSettings,
  type OrganizationSettingsRow,
  product,
  productPrice,
  promo,
  purchase,
  reward,
} from "@loyalty/db/schema";
import { and, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";

import type { UpdateLocalizationInput } from "./schemas";

/** A partial patch of the non-localization settings columns. */
type SettingsPatch = Partial<
  Pick<
    typeof organizationSettings.$inferInsert,
    | "description"
    | "brandColor"
    | "socialLinks"
    | "termsPdfUrl"
    | "loyaltyScope"
    | "seoTitle"
    | "seoDescription"
    | "seoKeywords"
    | "ogImageUrl"
    | "faviconUrl"
    | "smartDelivery"
    | "onboarding"
    | "loyaltyMode"
    | "pointsRates"
    | "pointsCardTemplate"
    | "tierGraceUntil"
  >
>;

/** Drizzle access for `organization_settings` (+ the org row's name/logo). */
export class SettingsRepository {
  constructor(private readonly db: typeof Db) {}

  async get(orgId: string): Promise<OrganizationSettingsRow | null> {
    const rows = await this.db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, orgId))
      .limit(1);
    return rows[0] ?? null;
  }

  async getOrg(orgId: string): Promise<{ name: string; logo: string | null } | null> {
    const rows = await this.db
      .select({ name: organization.name, logo: organization.logo })
      .from(organization)
      .where(eq(organization.id, orgId))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Insert-or-update the org's localization config. */
  async upsertLocalization(
    orgId: string,
    input: UpdateLocalizationInput,
  ): Promise<OrganizationSettingsRow> {
    const rows = await this.db
      .insert(organizationSettings)
      .values({ organizationId: orgId, ...input })
      .onConflictDoUpdate({
        target: organizationSettings.organizationId,
        set: { ...input, updatedAt: new Date() },
      })
      .returning();
    return rows[0]!;
  }

  /** Insert-or-update the non-localization settings columns (branding/SEO/scope).
   *  Localization columns keep their DB defaults on insert and stay untouched on
   *  update. */
  async upsertSettings(orgId: string, patch: SettingsPatch): Promise<OrganizationSettingsRow> {
    const rows = await this.db
      .insert(organizationSettings)
      .values({ organizationId: orgId, ...patch })
      .onConflictDoUpdate({
        target: organizationSettings.organizationId,
        set: { ...patch, updatedAt: new Date() },
      })
      .returning();
    return rows[0]!;
  }

  /** Update the org row's name / logo (managed columns on the Better Auth table). */
  async updateOrg(orgId: string, patch: { name?: string; logo?: string | null }): Promise<void> {
    if (patch.name === undefined && patch.logo === undefined) return;
    await this.db.update(organization).set(patch).where(eq(organization.id, orgId));
  }

  // ── Loyalty equivalence insights (static inputs for the live panel) ─────────

  /** Average ticket per currency from real, non-voided sales. */
  async avgTicketByCurrency(orgId: string): Promise<Map<string, number>> {
    const rows = await this.db
      .select({
        currency: purchase.currency,
        avg: sql<number>`avg(${purchase.priceCents})`,
      })
      .from(purchase)
      .where(and(eq(purchase.organizationId, orgId), isNull(purchase.voidedAt)))
      .groupBy(purchase.currency);
    return new Map(rows.map((r) => [r.currency, Math.round(Number(r.avg))]));
  }

  /** Catalog average price for one currency (day-one fallback, before sales).
   *  Default currency reads product base prices; others read the per-currency
   *  override rows. Zero-priced products (variant-priced) are excluded. */
  async catalogAvgPrice(
    orgId: string,
    currency: string,
    isDefaultCurrency: boolean,
  ): Promise<number | null> {
    if (isDefaultCurrency) {
      const rows = await this.db
        .select({ avg: sql<number>`avg(${product.basePriceCents})` })
        .from(product)
        .where(
          and(
            eq(product.organizationId, orgId),
            eq(product.status, "active"),
            gt(product.basePriceCents, 0),
          ),
        );
      const avg = rows[0]?.avg;
      return avg == null ? null : Math.round(Number(avg));
    }
    const rows = await this.db
      .select({ avg: sql<number>`avg(${productPrice.amountCents})` })
      .from(productPrice)
      .innerJoin(product, eq(product.id, productPrice.productId))
      .where(
        and(
          eq(product.organizationId, orgId),
          eq(product.status, "active"),
          eq(productPrice.currency, currency),
          gt(productPrice.amountCents, 0),
        ),
      );
    const avg = rows[0]?.avg;
    return avg == null ? null : Math.round(Number(avg));
  }

  /** Published rewards purchasable with points, cheapest first. */
  async pointsRewards(
    orgId: string,
  ): Promise<{ id: string; name: string; icon: string | null; pointsCost: number }[]> {
    const rows = await this.db
      .select({ id: reward.id, name: reward.name, icon: reward.icon, pointsCost: reward.pointsCost })
      .from(reward)
      .where(
        and(
          eq(reward.organizationId, orgId),
          eq(reward.status, "published"),
          isNotNull(reward.pointsCost),
        ),
      )
      .orderBy(reward.pointsCost);
    return rows.map((r) => ({ ...r, pointsCost: r.pointsCost! }));
  }

  /** Published promos whose effect multiplies points earn. */
  async multiplierPromos(
    orgId: string,
  ): Promise<{ id: string; name: string; multiplier: number }[]> {
    const rows = await this.db
      .select({ id: promo.id, name: promo.name, rule: promo.rule })
      .from(promo)
      .where(
        and(
          eq(promo.organizationId, orgId),
          eq(promo.status, "published"),
          sql`json_extract(${promo.rule}, '$.effect.kind') = 'pointsMultiplier'`,
        ),
      );
    return rows.map((r) => ({
      id: r.id,
      name: r.name ?? "",
      multiplier:
        r.rule?.effect.kind === "pointsMultiplier" ? r.rule.effect.multiplier : 1,
    }));
  }
}
