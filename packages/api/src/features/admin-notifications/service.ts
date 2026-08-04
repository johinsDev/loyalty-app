import { rolesAtOrAbove } from "@loyalty/auth/server";
import { TRPCError } from "@trpc/server";

import type { ListResult } from "../_shared/list";
import { ADMIN_ALERTS, type AdminAlertType } from "./catalog";
import type { AdminNotificationRepository } from "./repository";
import type { AdminAlertListItem, AdminAlertsListInput } from "./schemas";

/**
 * Thin orchestration over the inbox repository. Mutations that touch nothing
 * raise NOT_FOUND rather than reporting success, so a stale id in the UI
 * surfaces instead of silently no-op'ing (same contract as the customer feed).
 */
export class AdminNotificationService {
  constructor(private readonly repo: AdminNotificationRepository) {}

  list(
    userId: string,
    organizationId: string,
    input: AdminAlertsListInput,
  ): Promise<ListResult<AdminAlertListItem>> {
    return this.repo.listForUser(userId, organizationId, input);
  }

  unreadCount(
    userId: string,
    organizationId: string,
    storeId?: string,
  ): Promise<number> {
    return this.repo.unreadCount(userId, organizationId, storeId);
  }

  async markRead(
    id: string,
    userId: string,
    organizationId: string,
  ): Promise<{ ok: true }> {
    const affected = await this.repo.markRead(id, userId, organizationId);
    // Zero rows means either "not yours" or "already read" — both are fine to
    // report as done for an idempotent action, but a wrong id is not.
    if (affected === 0) {
      throw new TRPCError({ code: "NOT_FOUND", message: "alert not found" });
    }
    return { ok: true };
  }

  async markAllRead(
    userId: string,
    organizationId: string,
  ): Promise<{ updated: number }> {
    return { updated: await this.repo.markAllRead(userId, organizationId) };
  }

  async archive(
    ids: string[],
    userId: string,
    organizationId: string,
  ): Promise<{ updated: number }> {
    const updated = await this.repo.archive(ids, userId, organizationId);
    if (updated === 0) {
      throw new TRPCError({ code: "NOT_FOUND", message: "alert not found" });
    }
    return { updated };
  }

  async archiveAll(
    userId: string,
    organizationId: string,
  ): Promise<{ updated: number }> {
    return { updated: await this.repo.archiveAll(userId, organizationId) };
  }

  async unarchive(
    ids: string[],
    userId: string,
    organizationId: string,
  ): Promise<{ updated: number }> {
    const updated = await this.repo.unarchive(ids, userId, organizationId);
    if (updated === 0) {
      throw new TRPCError({ code: "NOT_FOUND", message: "alert not found" });
    }
    return { updated };
  }

  /**
   * Who should hear about an alert of this type. The role floor and the
   * store-scoping rule come from the catalog, so callers (the send job) only
   * need the type — they never reason about roles themselves.
   *
   * `actorUserId` is excluded: nobody needs an alert about their own action.
   */
  async audienceFor(
    organizationId: string,
    alertType: AdminAlertType,
    storeId: string | null,
    actorUserId?: string | null,
  ): Promise<string[]> {
    const def = ADMIN_ALERTS[alertType];
    const users = await this.repo.resolveAudience(
      organizationId,
      rolesAtOrAbove(def.minRole),
      def.storeScoped ? storeId : null,
    );
    return actorUserId ? users.filter((id) => id !== actorUserId) : users;
  }

  listOrganizationIds(): Promise<string[]> {
    return this.repo.listOrganizationIds();
  }

  digestCounts(
    organizationId: string,
    from: Date,
    to: Date,
  ): Promise<{
    signups: number;
    purchases: number;
    redemptions: number;
    adjustments: number;
  }> {
    return this.repo.digestCounts(organizationId, from, to);
  }

  /** Retention: drop archived rows older than `days`. */
  pruneArchived(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 86_400_000);
    return this.repo.pruneArchived(cutoff);
  }

  resolveDisplayNames(
    entity: { type: string; id: string } | undefined,
    actorUserId: string | null | undefined,
  ): Promise<{ entityName: string | null; actorName: string | null }> {
    return this.repo.resolveDisplayNames(entity, actorUserId);
  }
}
