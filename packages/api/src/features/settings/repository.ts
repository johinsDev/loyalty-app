import type { db as Db } from "@loyalty/db";
import {
  organizationSettings,
  type OrganizationSettingsRow,
} from "@loyalty/db/schema";
import { eq } from "drizzle-orm";

import type { UpdateLocalizationInput } from "./schemas";

/** Drizzle access for `organization_settings`. Only layer that touches the db. */
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
}
