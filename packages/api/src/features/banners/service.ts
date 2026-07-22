import { CacheManager } from "@loyalty/cache";
import type { db as Db } from "@loyalty/db";
import type { BannerRow } from "@loyalty/db/schema";
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
  BannerAnalytics,
  BannerCard,
  BannerDetail,
  BannerListItem,
  BannersListInput,
  BannerStats,
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
  homeBanners(orgId: string, lc: LocaleContext, storeId?: string): Promise<BannerCard[]> {
    return cache.getOrSet(
      `banners:${orgId}:home:${storeId ?? ""}:${lc.locale}`,
      () => this.repo.listHomeBanners(orgId, lc, storeId),
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
    await this.repo.bulkRemove(orgId, ids);
    await this.invalidate(orgId);
    return { ok: true };
  }

  /** Read-only admin detail: banner fields (for the preview) + display state +
   *  CTR stats. */
  async detail(orgId: string, id: string) {
    const row = await this.loadDraft(orgId, id);
    const stats = await this.stats(orgId, id);
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
      stats,
    };
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
    return {
      impressions,
      clicks,
      ctr: impressions > 0 ? clicks / impressions : 0,
      series,
    };
  }

  orgAnalytics(orgId: string, from?: Date): Promise<BannerAnalytics> {
    return this.repo.orgAnalytics(orgId, from ? dayInTz(STATS_TZ, from) : undefined);
  }

  async remove(orgId: string, id: string): Promise<{ ok: true }> {
    const row = await this.loadDraft(orgId, id);
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
