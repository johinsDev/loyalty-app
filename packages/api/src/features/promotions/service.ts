import { CacheManager } from "@loyalty/cache";
import type { db as Db } from "@loyalty/db";
import type { PromoRow } from "@loyalty/db/schema";
import { TRPCError } from "@trpc/server";

import { SUPPORTED_LOCALES, type LocaleContext } from "../_shared/localize";
import type { WizardState } from "../_shared/wizard";
import { evaluatePromo, type Cart, type CustomerFacts } from "./engine";
import type { AdminPromoRow, PromoPatch, PromoRepository } from "./repository";
import { ruleSchema, scheduleSchema, conditionsSchema } from "./schemas";
import type {
  AdminListInput,
  ApplicableHint,
  ApplicablePromo,
  ApplicableResult,
  PatchContentInput,
  PromoCard,
  PromoDetail,
  PublicListInput,
} from "./schemas";
import type { ListResult } from "../_shared/list";
import { promoTemplate } from "./templates";
import { promoWizard } from "./wizard";

const TTL_SECONDS = 600;
const cache = new CacheManager({
  default: "memory",
  stores: { memory: { provider: "memory" } },
});

export interface PromoWizardResult {
  promo: PromoRow;
  state: WizardState;
}

/**
 * Promotions business logic: cached + localized public reads, the server-driven
 * authoring wizard (create draft → advance steps → publish → archive), and the
 * checkout `applicable` evaluation via the pure engine. Redemption is recorded
 * by the itemized checkout (stamps feature).
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

  // ── Wizard (server-driven) ─────────────────────────────────────────────────
  async create(
    orgId: string,
    userId: string,
    templateKey: string | undefined,
    lc: LocaleContext,
  ): Promise<PromoWizardResult> {
    let preseed: PromoPatch = {};
    if (templateKey) {
      const tpl = promoTemplate(templateKey);
      if (!tpl) {
        throw new TRPCError({ code: "NOT_FOUND", message: `template "${templateKey}" not found` });
      }
      const name = lc.locale === "en" ? tpl.name.en : tpl.name.es;
      const short = lc.locale === "en" ? tpl.shortDescription.en : tpl.shortDescription.es;
      preseed = {
        name,
        type: tpl.type,
        rule: tpl.rule,
        schedule: tpl.schedule ?? null,
        conditions: tpl.conditions ?? {},
        badgeLabel: tpl.badgeLabel,
        backgroundCss: tpl.backgroundCss,
        shortDescription: short,
        seoTitle: name,
        seoDescription: short,
        slug: await this.repo.uniqueSlug(orgId, name),
      };
    }
    const row = await this.repo.createDraft(orgId, userId, preseed);
    return { promo: row, state: promoWizard.state(row) };
  }

  async getState(orgId: string, id: string): Promise<PromoWizardResult> {
    const row = await this.load(orgId, id);
    return { promo: row, state: promoWizard.state(row) };
  }

  async advance(
    orgId: string,
    userId: string,
    id: string,
    step: string,
    input: unknown,
  ): Promise<PromoWizardResult> {
    const current = await this.load(orgId, id);
    if (current.status !== "draft") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Published promos are immutable — archive and create a new one",
      });
    }
    const { draft, state } = await promoWizard.advance(
      { db: this.db, organizationId: orgId, userId, services: { repo: this.repo } },
      current,
      step,
      input,
    );
    return { promo: draft, state };
  }

  async publish(orgId: string, id: string): Promise<PromoRow> {
    const current = await this.load(orgId, id);
    if (current.status === "published") return current;
    if (current.status === "archived") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Archived promos can't be republished" });
    }
    const state = promoWizard.state(current);
    if (!state.canPublish) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Complete step "${state.current}" before publishing`,
      });
    }
    // Final guard: the stored JSON must parse against the current contracts.
    ruleSchema.parse(current.rule);
    if (current.schedule != null) scheduleSchema.parse(current.schedule);
    if (current.conditions != null) conditionsSchema.parse(current.conditions);
    const published = await this.repo.markPublished(orgId, id);
    await this.invalidate(orgId, published.slug ?? undefined);
    return published;
  }

  async archive(orgId: string, id: string): Promise<PromoRow> {
    const current = await this.load(orgId, id);
    if (current.status === "archived") return current;
    const archived = await this.repo.markArchived(orgId, id);
    await this.invalidate(orgId, archived.slug ?? undefined);
    return archived;
  }

  /** Post-publish edits: design/copy only — mechanics stay immutable. */
  async patchContent(orgId: string, input: PatchContentInput): Promise<PromoRow> {
    await this.load(orgId, input.id);
    const { id, mainImageUrl, ...rest } = input;
    const updated = await this.repo.patch(orgId, id, {
      ...rest,
      ...(mainImageUrl !== undefined ? { mainImageUrl: mainImageUrl || null } : {}),
      ...(rest.shortDescription ? { seoDescription: rest.shortDescription } : {}),
    });
    await this.invalidate(orgId, updated.slug ?? undefined);
    return updated;
  }

  async remove(orgId: string, id: string): Promise<{ ok: true }> {
    const row = await this.load(orgId, id);
    const uses = await this.repo.redemptionCount(id);
    if (uses > 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Promo has redemptions — archive it instead of deleting",
      });
    }
    await this.repo.remove(orgId, id);
    await this.invalidate(orgId, row.slug ?? undefined);
    return { ok: true };
  }

  adminList(orgId: string, input: AdminListInput): Promise<ListResult<AdminPromoRow>> {
    return this.repo.adminList(orgId, input);
  }

  get(orgId: string, id: string): Promise<PromoRow> {
    return this.load(orgId, id);
  }

  // ── Apply / checkout ───────────────────────────────────────────────────────
  /** Evaluate every published promo against the cart: applicable promos with
   *  their discount, plus upsell hints for missing get-sides. */
  async applicable(
    orgId: string,
    customerId: string,
    cart: Cart,
    lc: LocaleContext,
  ): Promise<ApplicableResult> {
    const promos = await this.repo.publishedPromos(orgId);
    if (promos.length === 0) return { applicable: [], hints: [] };

    const modifierIds = [...new Set(cart.lines.flatMap((l) => l.modifierOptionIds ?? []))];
    const [facts, counts, cats, deltas] = await Promise.all([
      this.repo.customerFacts(orgId, customerId),
      this.repo.redemptionCounts(
        promos.map((p) => p.id),
        customerId,
      ),
      this.repo.productCategories(cart.lines.map((l) => l.productId)),
      this.repo.modifierOptionDeltas(modifierIds),
    ]);
    const enriched: Cart = {
      currency: cart.currency,
      lines: cart.lines.map((l) => ({
        ...l,
        categoryIds: cats.get(l.productId) ?? [],
        modifierOptions: (l.modifierOptionIds ?? []).map((id) => ({
          id,
          priceDeltaCents: deltas.get(id) ?? 0,
        })),
      })),
    };

    const now = new Date();
    const applicable: ApplicablePromo[] = [];
    const hints: ApplicableHint[] = [];
    for (const p of promos) {
      const c = counts.get(p.id) ?? { total: 0, byCustomer: 0 };
      const customerFacts: CustomerFacts = {
        customerId,
        customerTierKey: facts.tierKey,
        customerPurchaseCount: facts.purchaseCount,
        customerLastPurchaseAt: facts.lastPurchaseAt,
        redemptionsTotal: c.total,
        redemptionsByCustomer: c.byCustomer,
      };
      const result = evaluatePromo(
        enriched,
        {
          status: p.status,
          startsAt: p.startsAt,
          endsAt: p.endsAt,
          rule: p.rule,
          schedule: p.schedule,
          conditions: p.conditions,
          audienceType: p.audienceType,
          tierKey: p.tierKey,
          audienceCustomerIds: p.audienceCustomerIds,
        },
        customerFacts,
        now,
      );
      if (result.eligible && (result.discountCents > 0 || result.pointsMultiplier > 1)) {
        applicable.push({
          promo: this.repo.cardOf(p, lc),
          discountCents: result.discountCents,
          pointsMultiplier: result.pointsMultiplier,
          applications: result.applications,
        });
      } else if (result.reason === "missing-get-side") {
        hints.push({ promo: this.repo.cardOf(p, lc), missingGetSide: result.missingGetSide });
      }
    }
    applicable.sort(
      (a, b) => b.discountCents - a.discountCents || b.pointsMultiplier - a.pointsMultiplier,
    );
    return { applicable, hints };
  }

  private async load(orgId: string, id: string): Promise<PromoRow> {
    const row = await this.repo.findById(orgId, id);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: `promo "${id}" not found` });
    return row;
  }
}
