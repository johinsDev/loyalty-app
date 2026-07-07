import type { db as Db } from "@loyalty/db";
import {
  organization,
  organizationSettings,
  type OrganizationSettingsRow,
} from "@loyalty/db/schema";
import { eq } from "drizzle-orm";

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
}
