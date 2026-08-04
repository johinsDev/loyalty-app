import type { Role } from "@loyalty/auth/server";
import { TRPCError } from "@trpc/server";

import type { ListResult } from "../_shared/list";
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

  resolveAudience(
    organizationId: string,
    roles: Role[],
    storeId: string | null,
  ): Promise<string[]> {
    return this.repo.resolveAudience(organizationId, roles, storeId);
  }
}
