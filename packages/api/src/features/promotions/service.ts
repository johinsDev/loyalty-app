import { CacheManager } from "@loyalty/cache";
import type { db as Db } from "@loyalty/db";
import type { PromoRow } from "@loyalty/db/schema";
import { runs, tasks } from "@trigger.dev/sdk/v3";
import { TRPCError } from "@trpc/server";

import { SUPPORTED_LOCALES, type LocaleContext } from "../_shared/localize";
import { computeDiscount, isEligible, type Cart } from "./engine";
import type { AdminListResult, PromoRepository } from "./repository";
import type {
  ApplicablePromo,
  CreateNotificationInput,
  ListInput,
  PromoCard,
  PromoDetail,
  PromoNotificationView,
  PublicListInput,
  UpdateInput,
} from "./schemas";

// Untyped trigger payload — avoids an @loyalty/api → @loyalty/jobs cycle. Stays
// in sync with packages/jobs/trigger/send-promo-notification.ts.
type SendPromoNotificationPayload = {
  organizationId: string;
  promoId: string;
  notificationId: string;
  audienceType: "all" | "tier" | "specific";
  tierKey?: string;
  customerIds?: string[];
  channels: string[];
};

const TTL_SECONDS = 600;
const cache = new CacheManager({
  default: "memory",
  stores: { memory: { provider: "memory" } },
});

/**
 * Promotions business logic: cached + localized public reads, admin CRUD
 * (create draft → patch fields → publish), and the checkout `applicable`
 * evaluation (eligibility + discount, via the pure engine). Apply/redemption is
 * recorded by the itemized checkout.
 */
export class PromoService {
  constructor(
    private readonly db: typeof Db,
    private readonly repo: PromoRepository,
  ) {}

  // ── Public (cached, localized) ─────────────────────────────────────────────
  homePromos(orgId: string, lc: LocaleContext): Promise<PromoCard[]> {
    return cache.getOrSet(
      `promos:${orgId}:home:${lc.locale}`,
      () => this.repo.listHomePromos(orgId, lc),
      TTL_SECONDS,
    );
  }
  listPromos(
    orgId: string,
    lc: LocaleContext,
    input: PublicListInput,
  ): Promise<{ items: PromoCard[]; nextCursor: string | null }> {
    return cache.getOrSet(
      `promos:${orgId}:list:${input.category ?? ""}:${input.cursor ?? ""}:${input.pageSize}:${lc.locale}`,
      () => this.repo.listPromos(orgId, lc, input),
      TTL_SECONDS,
    );
  }
  promoBySlug(orgId: string, slug: string, lc: LocaleContext): Promise<PromoDetail | null> {
    return cache.getOrSet(
      `promos:${orgId}:detail:${slug}:${lc.locale}`,
      () => this.repo.promoBySlug(orgId, slug, lc),
      TTL_SECONDS,
    );
  }
  async invalidate(orgId: string, slug?: string): Promise<void> {
    const keys: string[] = [];
    for (const locale of SUPPORTED_LOCALES) {
      keys.push(`promos:${orgId}:home:${locale}`);
      if (slug) keys.push(`promos:${orgId}:detail:${slug}:${locale}`);
    }
    await cache.deleteMany(keys);
  }

  // ── Admin ──────────────────────────────────────────────────────────────────
  create(orgId: string, userId: string): Promise<PromoRow> {
    return this.repo.createDraft(orgId, userId);
  }
  list(orgId: string, input: ListInput): Promise<AdminListResult> {
    return this.repo.list(orgId, input);
  }
  get(orgId: string, id: string): Promise<PromoRow> {
    return this.load(orgId, id);
  }

  async update(orgId: string, input: UpdateInput): Promise<PromoRow> {
    const current = await this.load(orgId, input.id);
    const { id, slug, mainImageUrl, ...rest } = input;
    let nextSlug: string | undefined;
    if (slug) nextSlug = await this.repo.uniqueSlug(orgId, slug, id);
    else if (rest.name && (current.slug == null || current.slug.startsWith("borrador-")))
      nextSlug = await this.repo.uniqueSlug(orgId, rest.name, id);
    const updated = await this.repo.patch(orgId, id, {
      ...rest,
      ...(nextSlug ? { slug: nextSlug } : {}),
      ...(mainImageUrl !== undefined ? { mainImageUrl: mainImageUrl || null } : {}),
      ...(rest.name ? { seoTitle: rest.name } : {}),
      ...(rest.shortDescription ? { seoDescription: rest.shortDescription } : {}),
    });
    await this.invalidate(orgId, updated.slug ?? undefined);
    return updated;
  }

  async publish(orgId: string, id: string): Promise<PromoRow> {
    const current = await this.load(orgId, id);
    if (current.status === "published") return current;
    if (!current.name || !current.type || !current.benefit || !current.scopeKind) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Completa nombre, tipo, beneficio y alcance antes de publicar",
      });
    }
    const published = await this.repo.markPublished(orgId, id);
    await this.invalidate(orgId, published.slug ?? undefined);
    return published;
  }

  async remove(orgId: string, id: string): Promise<{ ok: true }> {
    const row = await this.load(orgId, id);
    await this.repo.remove(orgId, id);
    await this.invalidate(orgId, row.slug ?? undefined);
    return { ok: true };
  }

  // ── Apply / checkout ───────────────────────────────────────────────────────
  /** Promos a customer can apply to the given cart, with computed discount. */
  async applicable(
    orgId: string,
    customerId: string,
    cart: Cart,
    lc: LocaleContext,
  ): Promise<ApplicablePromo[]> {
    const promos = await this.repo.publishedPromos(orgId);
    if (promos.length === 0) return [];
    const [facts, counts, cats] = await Promise.all([
      this.repo.customerFacts(orgId, customerId),
      this.repo.redemptionCounts(
        promos.map((p) => p.id),
        customerId,
      ),
      this.repo.productCategories(cart.lines.map((l) => l.productId)),
    ]);
    const enriched: Cart = {
      currency: cart.currency,
      lines: cart.lines.map((l) => ({ ...l, categoryIds: cats.get(l.productId) ?? [] })),
    };
    const now = new Date();
    const out: ApplicablePromo[] = [];
    for (const p of promos) {
      const c = counts.get(p.id) ?? { total: 0, byCustomer: 0 };
      const eligible = isEligible({
        now,
        status: p.status,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
        audienceType: p.audienceType,
        tierKey: p.tierKey,
        audienceCustomerIds: p.audienceCustomerIds,
        conditions: p.conditions,
        customerTierKey: facts.tierKey,
        customerId,
        customerPurchaseCount: facts.purchaseCount,
        redemptionsTotal: c.total,
        redemptionsByCustomer: c.byCustomer,
        cart: enriched,
        scopeKind: p.scopeKind,
        scope: p.scope,
      });
      if (!eligible) continue;
      const d = computeDiscount(enriched, {
        type: p.type,
        benefit: p.benefit,
        scopeKind: p.scopeKind,
        scope: p.scope,
        conditions: p.conditions,
      });
      if (d.discountCents <= 0 && d.pointsMultiplier <= 1) continue;
      out.push({
        promo: this.repo.cardOf(p, lc),
        discountCents: d.discountCents,
        pointsMultiplier: d.pointsMultiplier,
      });
    }
    return out;
  }

  // ── Notifications (Trigger owns one-shot; cron owns weekly) ─────────────────
  async createNotification(
    orgId: string,
    input: CreateNotificationInput,
  ): Promise<PromoNotificationView> {
    const promo = await this.load(orgId, input.promoId);
    const audienceValue =
      input.audienceType === "tier"
        ? JSON.stringify({ tierKey: input.tierKey })
        : input.audienceType === "specific"
          ? JSON.stringify({ customerIds: input.customerIds })
          : null;
    const row = await this.repo.createNotification({
      promoId: promo.id,
      audienceType: input.audienceType,
      audienceValue,
      channels: JSON.stringify(input.channels),
      scheduledAt: input.scheduledAt ?? null,
      repeat: input.repeat,
      status: "scheduled",
    });

    // Weekly recurrence is driven by the daily cron; one-shot uses a native
    // delayed run so we can cancel/track it.
    if (input.repeat === "none") {
      const payload: SendPromoNotificationPayload = {
        organizationId: orgId,
        promoId: promo.id,
        notificationId: row.id,
        audienceType: input.audienceType,
        tierKey: input.tierKey,
        customerIds: input.customerIds,
        channels: input.channels,
      };
      const handle = await tasks.trigger(
        "send-promo-notification",
        payload,
        input.scheduledAt ? { delay: input.scheduledAt } : undefined,
      );
      await this.repo.setNotificationRun(row.id, handle.id);
    }
    return this.toNotificationView(row);
  }

  async listNotifications(promoId: string): Promise<PromoNotificationView[]> {
    const rows = await this.repo.listNotifications(promoId);
    return rows.map((r) => this.toNotificationView(r));
  }

  async cancelNotification(id: string): Promise<{ ok: true }> {
    const row = await this.repo.getNotification(id);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "notification not found" });
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
    repeat: string;
    status: string;
  }): PromoNotificationView {
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
      repeat: row.repeat,
      status: row.status,
    };
  }

  private async load(orgId: string, id: string): Promise<PromoRow> {
    const row = await this.repo.findById(orgId, id);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: `promo "${id}" not found` });
    return row;
  }
}
