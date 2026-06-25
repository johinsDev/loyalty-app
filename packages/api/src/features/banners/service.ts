import { CacheManager } from "@loyalty/cache";
import type { db as Db } from "@loyalty/db";
import type { BannerRow } from "@loyalty/db/schema";
import { runs, tasks } from "@trigger.dev/sdk/v3";
import { TRPCError } from "@trpc/server";

import type { WizardState } from "../_shared/wizard";
import {
  displayState,
  type AdminListResult,
  type BannersRepository,
} from "./repository";
import type {
  BannerCard,
  BannerDetail,
  BannerNotificationView,
  CreateNotificationInput,
  ListInput,
  BannerStepKey,
} from "./schemas";
import { bannerWizard } from "./wizard";

// Public reads are cached (banners rarely change); admin mutations invalidate.
const TTL_SECONDS = 600;
const cache = new CacheManager({
  default: "memory",
  stores: { memory: { provider: "memory" } },
});

// Untyped trigger payload — typing it would make @loyalty/api depend on
// @loyalty/jobs (which already depends on api → cycle). Stays in sync with
// packages/jobs/trigger/send-banner-notification.ts.
type SendBannerNotificationPayload = {
  organizationId: string;
  bannerId: string;
  notificationId: string;
  audienceType: "all" | "tier" | "specific";
  tierKey?: string;
  customerIds?: string[];
  channels: string[];
};

export interface BannerStateResult {
  banner: BannerRow;
  state: WizardState;
}

export class BannersService {
  constructor(
    private readonly db: typeof Db,
    private readonly repo: BannersRepository,
  ) {}

  // ── Public (cached) ───────────────────────────────────────────────────────
  homeBanners(orgId: string): Promise<BannerCard[]> {
    return cache.getOrSet(
      `banners:${orgId}:home`,
      () => this.repo.listHomeBanners(orgId),
      TTL_SECONDS,
    );
  }

  bannerBySlug(orgId: string, slug: string): Promise<BannerDetail | null> {
    return cache.getOrSet(
      `banners:${orgId}:detail:${slug}`,
      () => this.repo.bannerBySlug(orgId, slug),
      TTL_SECONDS,
    );
  }

  /** Drop cached public reads after an admin mutation. */
  async invalidate(orgId: string, slug?: string): Promise<void> {
    const keys = [`banners:${orgId}:home`];
    if (slug) keys.push(`banners:${orgId}:detail:${slug}`);
    await cache.deleteMany(keys);
  }

  // ── Admin wizard ──────────────────────────────────────────────────────────
  async create(orgId: string): Promise<BannerStateResult> {
    const row = await this.repo.createDraft(orgId);
    return { banner: row, state: bannerWizard.state(row) };
  }

  async getState(orgId: string, id: string): Promise<BannerStateResult> {
    const row = await this.loadDraft(orgId, id);
    return { banner: row, state: bannerWizard.state(row) };
  }

  async advance(
    orgId: string,
    userId: string,
    id: string,
    step: BannerStepKey,
    input: unknown,
  ): Promise<BannerStateResult> {
    const current = await this.loadDraft(orgId, id);
    const { draft, state } = await bannerWizard.advance(
      { db: this.db, organizationId: orgId, userId, services: { repo: this.repo } },
      current,
      step,
      input,
    );
    await this.invalidate(orgId, draft.slug);
    return { banner: draft, state };
  }

  async publish(orgId: string, id: string): Promise<BannerStateResult> {
    const current = await this.loadDraft(orgId, id);
    if (current.status === "published") {
      return { banner: current, state: bannerWizard.state(current) };
    }
    const state = bannerWizard.state(current);
    if (!state.canPublish) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Complete content and design before publishing",
      });
    }
    const published = await this.repo.markPublished(orgId, id);
    await this.invalidate(orgId, published.slug);
    return { banner: published, state: bannerWizard.state(published) };
  }

  list(orgId: string, input: ListInput): Promise<AdminListResult> {
    return this.repo.list(orgId, input);
  }

  async remove(orgId: string, id: string): Promise<{ ok: true }> {
    const row = await this.loadDraft(orgId, id);
    // Cancel any still-scheduled Trigger runs before deleting.
    const notifs = await this.repo.listNotifications(id);
    await Promise.all(
      notifs
        .filter((n) => n.status === "scheduled" && n.runId)
        .map((n) => runs.cancel(n.runId!).catch(() => undefined)),
    );
    await this.repo.remove(orgId, id);
    await this.invalidate(orgId, row.slug);
    return { ok: true };
  }

  async reorder(orgId: string, ids: string[]): Promise<{ ok: true }> {
    await this.repo.reorder(orgId, ids);
    await this.invalidate(orgId);
    return { ok: true };
  }

  slugAvailable(orgId: string, slug: string, excludeId?: string): Promise<boolean> {
    return this.repo.slugExists(orgId, slug, excludeId).then((exists) => !exists);
  }

  // ── Notifications (Trigger owns execution) ─────────────────────────────────
  async createNotification(
    orgId: string,
    input: CreateNotificationInput,
  ): Promise<BannerNotificationView> {
    const banner = await this.loadDraft(orgId, input.bannerId);
    const audienceValue =
      input.audienceType === "tier"
        ? JSON.stringify({ tierKey: input.tierKey })
        : input.audienceType === "specific"
          ? JSON.stringify({ customerIds: input.customerIds })
          : null;

    const row = await this.repo.createNotification({
      bannerId: banner.id,
      audienceType: input.audienceType,
      audienceValue,
      channels: JSON.stringify(input.channels),
      scheduledAt: input.scheduledAt ?? null,
      status: "scheduled",
    });

    const payload: SendBannerNotificationPayload = {
      organizationId: orgId,
      bannerId: banner.id,
      notificationId: row.id,
      audienceType: input.audienceType,
      tierKey: input.tierKey,
      customerIds: input.customerIds,
      channels: input.channels,
    };
    const handle = await tasks.trigger(
      "send-banner-notification",
      payload,
      input.scheduledAt ? { delay: input.scheduledAt } : undefined,
    );
    await this.repo.setNotificationRun(row.id, handle.id);
    return this.toNotificationView({ ...row, runId: handle.id });
  }

  async listNotifications(bannerId: string): Promise<BannerNotificationView[]> {
    const rows = await this.repo.listNotifications(bannerId);
    return rows.map((r) => this.toNotificationView(r));
  }

  async cancelNotification(id: string): Promise<{ ok: true }> {
    const row = await this.repo.getNotification(id);
    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: "notification not found" });
    }
    if (row.runId) await runs.cancel(row.runId).catch(() => undefined);
    await this.repo.setNotificationStatus(id, "canceled");
    return { ok: true };
  }

  private toNotificationView(row: {
    id: string;
    audienceType: string;
    audienceValue: string | null;
    channels: string;
    scheduledAt: Date | null;
    status: string;
    runId: string | null;
  }): BannerNotificationView {
    const parsed = row.audienceValue
      ? (JSON.parse(row.audienceValue) as { tierKey?: string; customerIds?: string[] })
      : {};
    return {
      id: row.id,
      audienceType: row.audienceType as "all" | "tier" | "specific",
      tierKey: parsed.tierKey ?? null,
      customerCount: parsed.customerIds?.length ?? null,
      channels: JSON.parse(row.channels) as string[],
      scheduledAt: row.scheduledAt,
      status: row.status,
      runId: row.runId,
    };
  }

  /** Derive the admin display state (also exported via repository). */
  displayStateOf(row: BannerRow) {
    return displayState(row);
  }

  private async loadDraft(orgId: string, id: string): Promise<BannerRow> {
    const row = await this.repo.findById(orgId, id);
    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: `banner "${id}" not found` });
    }
    return row;
  }
}
