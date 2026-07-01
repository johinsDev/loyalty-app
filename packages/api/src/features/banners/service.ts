import { CacheManager } from "@loyalty/cache";
import type { db as Db } from "@loyalty/db";
import type { BannerRow } from "@loyalty/db/schema";
import { runs, tasks } from "@trigger.dev/sdk/v3";
import { TRPCError } from "@trpc/server";

import { SUPPORTED_LOCALES, type LocaleContext } from "../_shared/localize";
import type { WizardState } from "../_shared/wizard";
import {
  displayState,
  type AdminListResult,
  type BannersRepository,
} from "./repository";
import type { ListResult } from "../_shared/list";
import type {
  AudienceReach,
  BannerAnalytics,
  BannerCard,
  BannerDetail,
  BannerListItem,
  BannerNotificationView,
  BannersListInput,
  BannerStats,
  CountByAudienceInput,
  CreateNotificationInput,
  ListInput,
  BannerStepKey,
} from "./schemas";
import { bannerWizard } from "./wizard";

/** Operating timezone for daily stat buckets (single-location pilot). */
const STATS_TZ = "America/Bogota";
const dayInTz = (tz: string, d = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

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

  // ── Public (cached; banners have no price → keyed by locale only) ─────────
  homeBanners(orgId: string, lc: LocaleContext): Promise<BannerCard[]> {
    return cache.getOrSet(
      `banners:${orgId}:home:${lc.locale}`,
      () => this.repo.listHomeBanners(orgId, lc),
      TTL_SECONDS,
    );
  }

  bannerBySlug(
    orgId: string,
    slug: string,
    lc: LocaleContext,
  ): Promise<BannerDetail | null> {
    return cache.getOrSet(
      `banners:${orgId}:detail:${slug}:${lc.locale}`,
      () => this.repo.bannerBySlug(orgId, slug, lc),
      TTL_SECONDS,
    );
  }

  /** Drop cached public reads (all locales) after an admin mutation. */
  async invalidate(orgId: string, slug?: string): Promise<void> {
    const keys: string[] = [];
    for (const locale of SUPPORTED_LOCALES) {
      keys.push(`banners:${orgId}:home:${locale}`);
      if (slug) keys.push(`banners:${orgId}:detail:${slug}:${locale}`);
    }
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

  // ── Admin data-table + detail ─────────────────────────────────────────────
  adminList(orgId: string, input: BannersListInput): Promise<ListResult<BannerListItem>> {
    return this.repo.adminList(orgId, input);
  }

  listByIds(orgId: string, ids: string[]): Promise<BannerListItem[]> {
    return this.repo.listByIds(orgId, ids);
  }

  async bulkRemove(orgId: string, ids: string[]): Promise<{ ok: true }> {
    for (const id of ids) {
      const notifs = await this.repo.listNotifications(id).catch(() => []);
      await Promise.all(
        notifs
          .filter((n) => n.status === "scheduled" && n.runId)
          .map((n) => runs.cancel(n.runId!).catch(() => undefined)),
      );
    }
    await this.repo.bulkRemove(orgId, ids);
    await this.invalidate(orgId);
    return { ok: true };
  }

  /** Read-only admin detail: banner fields (for the preview) + display state +
   *  notifications + CTR stats. */
  async detail(orgId: string, id: string) {
    const row = await this.loadDraft(orgId, id);
    const [notifications, stats] = await Promise.all([
      this.listNotifications(id),
      this.stats(orgId, id),
    ]);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      status: row.status,
      displayState: displayState(row),
      shortDescription: row.shortDescription,
      longDescription: row.longDescription,
      backgroundCss: row.backgroundCss,
      mainImageUrl: row.mainImageUrl,
      cta: row.ctaHref
        ? {
            label: row.ctaLabel ?? "",
            href: row.ctaHref,
            kind: (row.ctaKind as "internal" | "external") ?? "external",
          }
        : null,
      displayFrom: row.displayFrom,
      displayUntil: row.displayUntil,
      createdAt: row.createdAt,
      notifications,
      stats,
    };
  }

  // ── Reach preview (audience − marketing opt-outs) ─────────────────────────
  async countByAudience(orgId: string, input: CountByAudienceInput): Promise<AudienceReach> {
    const optOut = await this.repo.marketingOptOutIds(orgId);
    if (input.audienceType === "all") {
      const audience = await this.repo.countCustomers(orgId);
      return { audience, eligible: Math.max(0, audience - optOut.size) };
    }
    if (input.audienceType === "tier") {
      const ids = await this.repo.listCustomerIdsByTier(orgId, input.tierKey!);
      return { audience: ids.length, eligible: ids.filter((id) => !optOut.has(id)).length };
    }
    const ids = input.customerIds ?? [];
    return { audience: ids.length, eligible: ids.filter((id) => !optOut.has(id)).length };
  }

  private async audienceSize(
    orgId: string,
    type: string,
    audienceValue: { tierKey?: string; customerIds?: string[] },
  ): Promise<number> {
    if (type === "all") return this.repo.countCustomers(orgId);
    if (type === "tier") return this.repo.countCustomersByTier(orgId, audienceValue.tierKey ?? "");
    return audienceValue.customerIds?.length ?? 0;
  }

  // ── CTR: ingest (from the customer web app) + read ────────────────────────
  async recordImpression(orgId: string, id: string): Promise<{ ok: true }> {
    const row = await this.repo.findById(orgId, id);
    if (row) await this.repo.recordStat(orgId, id, dayInTz(STATS_TZ), "impressions");
    return { ok: true };
  }

  async recordClick(orgId: string, id: string): Promise<{ ok: true }> {
    const row = await this.repo.findById(orgId, id);
    if (row) await this.repo.recordStat(orgId, id, dayInTz(STATS_TZ), "clicks");
    return { ok: true };
  }

  async stats(orgId: string, bannerId: string, from?: Date, to?: Date): Promise<BannerStats> {
    const series = await this.repo.dailyStats(
      orgId,
      bannerId,
      from ? dayInTz(STATS_TZ, from) : undefined,
      to ? dayInTz(STATS_TZ, to) : undefined,
    );
    const impressions = series.reduce((s, r) => s + r.impressions, 0);
    const clicks = series.reduce((s, r) => s + r.clicks, 0);
    const notifs = await this.repo.listNotifications(bannerId);
    let reach = 0;
    for (const n of notifs) {
      const parsed = n.audienceValue
        ? (JSON.parse(n.audienceValue) as { tierKey?: string; customerIds?: string[] })
        : {};
      reach += await this.audienceSize(orgId, n.audienceType, parsed);
    }
    return {
      impressions,
      clicks,
      ctr: impressions > 0 ? clicks / impressions : 0,
      series,
      notifications: notifs.length,
      reach,
    };
  }

  orgAnalytics(orgId: string, from?: Date): Promise<BannerAnalytics> {
    return this.repo.orgAnalytics(orgId, from ? dayInTz(STATS_TZ, from) : undefined);
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
