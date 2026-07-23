import type { db as Db } from "@loyalty/db";
import { tasks } from "@trigger.dev/sdk/v3";

import {
  DEFAULT_POINTS_RATE,
  DEFAULT_STAMPS_GOAL,
  earnsPoints,
  earnsStamps,
  getBranding,
  getLocalization,
  getLoyaltyConfig,
  invalidateBranding,
  invalidateLocalization,
  invalidateLoyaltyConfig,
  pickTranslation,
} from "../_shared/localize";
import type { SettingsRepository } from "./repository";
import { TRPCError } from "@trpc/server";
import type { StampCardCopy, StampCardCopyKey } from "@loyalty/db/schema";

import {
  STAMP_CARD_COPY_KEYS,
  STAMP_COPY_PLACEHOLDERS,
  type BrandingView,
  type LocalizationView,
  type LoyaltyConfigAdminView,
  type LoyaltyConfigView,
  type LoyaltyInsights,
  type OnboardingAdminStep,
  type OnboardingStepView,
  type SetLoyaltyScopeInput,
  type SmartDeliveryView,
  type StampsCardPublicView,
  type StampsConfigAdminView,
  type UpdateBrandingInput,
  type UpdateLocalizationInput,
  type StackingPolicyInput,
  type UpdateLoyaltyConfigInput,
  type UpdateOnboardingInput,
  type UpdateSeoInput,
  type UpdateSmartDeliveryInput,
  type UpdateStampsConfigInput,
} from "./schemas";

/** What a mode change did to each track — drives the customer announcement. */
export type LoyaltyModeChange =
  | "points-paused"
  | "points-resumed"
  | "stamps-paused"
  | "stamps-resumed";

/** Post-reactivation window in which tier recomputes may only raise a tier. */
const TIER_GRACE_DAYS = 30;

/** "" → null, undefined → undefined (skip). Keeps cleared fields nullable. */
function nullable(v: string | undefined): string | null | undefined {
  return v === undefined ? undefined : v === "" ? null : v;
}

/**
 * Whether saving this stamps config must re-evaluate reward availability:
 * only when a linked goal got LOWER than the effective one (customers may
 * already be at the new goal) or the prize was relinked (different reward's
 * availability needs arming). Raising the goal never revokes anything, and an
 * unlink just falls back — neither needs the job.
 */
export function shouldReevaluateStampGoal(
  before: { goal: number; cardRewardId: string | null },
  input: { goal: number; cardRewardId: string | null },
): boolean {
  if (!input.cardRewardId) return false;
  return input.goal < before.goal || input.cardRewardId !== before.cardRewardId;
}

/**
 * Enforce the per-key placeholder policy on stamp-card copy overrides: only
 * `allowed` tokens may appear (anything else renders literally in the PWA) and
 * every `required` one must be present. Throws `STAMPS_COPY_PLACEHOLDER:
 * <locale>.<key>` so the editor can point at the exact field.
 */
export function validateStampCopy(copy: StampCardCopy): void {
  for (const [locale, entries] of Object.entries(copy)) {
    for (const key of STAMP_CARD_COPY_KEYS) {
      const value = entries?.[key];
      if (!value) continue;
      const policy = STAMP_COPY_PLACEHOLDERS[key];
      const tokens = [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
      const bad =
        tokens.some((t) => !policy.allowed.includes(t)) ||
        policy.required.some((t) => !tokens.includes(t));
      if (bad) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `STAMPS_COPY_PLACEHOLDER:${locale}.${key}`,
        });
      }
    }
  }
}

/**
 * Org settings business logic: localization (locale/currency) + branding (name/
 * logo/color/social/T&C), SEO, and the loyalty wallet scope. Reads go through the
 * cached `getLocalization` / `getBranding` helpers (shared with the apps' SSR +
 * content features); writes upsert + invalidate.
 */
export class SettingsService {
  constructor(
    private readonly db: typeof Db,
    private readonly repo: SettingsRepository,
  ) {}

  localization(orgId: string): Promise<LocalizationView> {
    return getLocalization(this.db, orgId);
  }

  async updateLocalization(
    orgId: string,
    input: UpdateLocalizationInput,
  ): Promise<LocalizationView> {
    const row = await this.repo.upsertLocalization(orgId, input);
    await invalidateLocalization(orgId);
    return {
      defaultLocale: row.defaultLocale,
      enabledLocales: row.enabledLocales,
      defaultCurrency: row.defaultCurrency,
      enabledCurrencies: row.enabledCurrencies,
    };
  }

  // ── Branding ────────────────────────────────────────────────────────────────
  branding(orgId: string): Promise<BrandingView> {
    return getBranding(this.db, orgId);
  }

  async updateBranding(orgId: string, input: UpdateBrandingInput): Promise<BrandingView> {
    await this.repo.updateOrg(orgId, {
      name: input.name,
      logo: nullable(input.logoUrl),
    });
    await this.repo.upsertSettings(orgId, {
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.brandColor !== undefined ? { brandColor: nullable(input.brandColor) } : {}),
      ...(input.socialLinks !== undefined ? { socialLinks: input.socialLinks } : {}),
      ...(input.termsPdfUrl !== undefined ? { termsPdfUrl: nullable(input.termsPdfUrl) } : {}),
      ...(input.phone !== undefined ? { phone: nullable(input.phone) } : {}),
      ...(input.defaultHours !== undefined ? { defaultHours: input.defaultHours } : {}),
    });
    await invalidateBranding(orgId);
    return getBranding(this.db, orgId);
  }

  async updateSeo(orgId: string, input: UpdateSeoInput): Promise<BrandingView> {
    await this.repo.upsertSettings(orgId, {
      ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle } : {}),
      ...(input.seoDescription !== undefined ? { seoDescription: input.seoDescription } : {}),
      ...(input.seoKeywords !== undefined ? { seoKeywords: input.seoKeywords } : {}),
      ...(input.ogImageUrl !== undefined ? { ogImageUrl: nullable(input.ogImageUrl) } : {}),
      ...(input.faviconUrl !== undefined ? { faviconUrl: nullable(input.faviconUrl) } : {}),
    });
    await invalidateBranding(orgId);
    return getBranding(this.db, orgId);
  }

  async setLoyaltyScope(orgId: string, input: SetLoyaltyScopeInput): Promise<BrandingView> {
    await this.repo.upsertSettings(orgId, { loyaltyScope: input.loyaltyScope });
    await invalidateBranding(orgId);
    return getBranding(this.db, orgId);
  }

  // ── Smart Delivery (campaign global rules) ────────────────────────────────
  async smartDelivery(orgId: string): Promise<SmartDeliveryView> {
    const row = await this.repo.get(orgId);
    const r = row?.smartDelivery;
    return {
      frequencyCapPerWeek: r?.frequencyCapPerWeek ?? null,
      quietHoursStart: r?.quietHoursStart ?? null,
      quietHoursEnd: r?.quietHoursEnd ?? null,
    };
  }

  async updateSmartDelivery(
    orgId: string,
    input: UpdateSmartDeliveryInput,
  ): Promise<SmartDeliveryView> {
    await this.repo.upsertSettings(orgId, { smartDelivery: input });
    return this.smartDelivery(orgId);
  }

  // ── Onboarding (customer PWA first-run carousel) ──────────────────────────
  /** Every step with all locales — for the admin editor. */
  async onboardingAdmin(orgId: string): Promise<OnboardingAdminStep[]> {
    const row = await this.repo.get(orgId);
    return (row?.onboarding ?? []).map((s) => ({
      id: s.id,
      icon: s.icon,
      backgroundCss: s.backgroundCss,
      text: s.text,
    }));
  }

  /** Steps resolved to `locale`, falling back to the org default per field —
   *  for the customer app. Empty array when unconfigured (app shows its own
   *  built-in default). */
  async onboarding(orgId: string, locale: string): Promise<OnboardingStepView[]> {
    const [row, loc] = await Promise.all([
      this.repo.get(orgId),
      getLocalization(this.db, orgId),
    ]);
    const steps = row?.onboarding ?? [];
    return steps.map((s) => {
      const t = s.text[locale] ?? s.text[loc.defaultLocale] ?? { title: "", body: "" };
      const fallback = s.text[loc.defaultLocale];
      return {
        id: s.id,
        icon: s.icon,
        backgroundCss: s.backgroundCss,
        title: t.title || fallback?.title || "",
        body: t.body || fallback?.body || "",
      };
    });
  }

  async updateOnboarding(
    orgId: string,
    input: UpdateOnboardingInput,
  ): Promise<OnboardingAdminStep[]> {
    const loc = await getLocalization(this.db, orgId);
    // Every step must carry a title in the org's default locale — that's the
    // fallback the customer read relies on; without it a step renders blank.
    // `input.text` keys are the locale enum; index by the (string) default
    // locale through a widened view.
    const titleIn = (text: UpdateOnboardingInput["steps"][number]["text"], locale: string) =>
      (text as Record<string, { title: string; body: string }>)[locale]?.title;
    const missing = input.steps.findIndex((s) => !titleIn(s.text, loc.defaultLocale)?.trim());
    if (missing !== -1) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `ONBOARDING_DEFAULT_TITLE_REQUIRED:${missing}`,
      });
    }
    await this.repo.upsertSettings(orgId, { onboarding: input.steps });
    return this.onboardingAdmin(orgId);
  }

  // ── Loyalty earn config ─────────────────────────────────────────────────────

  /** Public: what the PWA needs pre-render (locale-resolved stamp card copy +
   *  prize). Rates stay manager-only. */
  async loyaltyConfig(
    orgId: string,
    lc: { locale: string; defaultLocale: string },
  ): Promise<LoyaltyConfigView> {
    const cfg = await getLoyaltyConfig(this.db, orgId);
    const s = cfg.stamps;

    // Copy overrides resolved to the request locale, org default as fallback.
    const copy: Partial<Record<StampCardCopyKey, string>> = {
      ...s.copy?.[lc.defaultLocale],
      ...s.copy?.[lc.locale],
    };

    // Prize = the linked reward's localized name/description (single pk read;
    // only when linked). Copy overrides for reward* still win in the FE.
    let prize: StampsCardPublicView["prize"] = null;
    if (s.cardRewardId) {
      const rw = await this.repo.getReward(orgId, s.cardRewardId);
      if (rw) {
        const translations = await this.repo.rewardTranslations(rw.id);
        prize = pickTranslation(rw, translations, lc);
      }
    }

    return {
      mode: cfg.mode,
      pointsCardTemplate: cfg.pointsCardTemplate,
      stampsCard: {
        template: s.cardTemplate,
        goal: s.goal,
        purchasesPerStamp: s.purchasesPerStamp,
        style: s.style,
        copy,
        prize,
      },
    };
  }

  /** Admin: full config, rates seeded for every enabled currency. */
  async loyaltyConfigAdmin(orgId: string): Promise<LoyaltyConfigAdminView> {
    const [cfg, loc] = await Promise.all([
      getLoyaltyConfig(this.db, orgId),
      getLocalization(this.db, orgId),
    ]);
    // Seed a visible default for any enabled currency the org never rated, so
    // the editor always shows one row per currency.
    const pointsRates = Object.fromEntries(
      loc.enabledCurrencies.map((c) => [c, cfg.pointsRates[c] ?? DEFAULT_POINTS_RATE]),
    );
    return {
      mode: cfg.mode,
      pointsCardTemplate: cfg.pointsCardTemplate,
      pointsRates,
      tierGraceUntil: cfg.tierGraceUntil,
      stacking: cfg.stacking,
    };
  }

  /** Save the register discount-stacking policy (reward · promo · tier + cap). */
  async updateStackingPolicy(orgId: string, input: StackingPolicyInput): Promise<void> {
    await this.repo.upsertSettings(orgId, {
      tierStacksWithPromo: input.tierStacksWithPromo,
      rewardStacksWithPromo: input.rewardStacksWithPromo,
      maxTotalDiscountPct: input.maxTotalDiscountPct,
    });
    await invalidateLoyaltyConfig(orgId);
  }

  /**
   * Save mode + rates. Side effects: pausing/resuming a track enqueues the
   * customer announcement job, and resuming POINTS arms the tier grace window
   * (the 30d earn window restarts empty — without grace everyone would drop
   * tier the next day). Redemption is never touched.
   */
  async updateLoyaltyConfig(
    orgId: string,
    input: UpdateLoyaltyConfigInput,
  ): Promise<LoyaltyConfigAdminView> {
    const [before, loc] = await Promise.all([
      getLoyaltyConfig(this.db, orgId),
      getLocalization(this.db, orgId),
    ]);

    // `input.pointsRates` keys are the currency enum; index via a widened view.
    const rates = input.pointsRates as Record<string, { per: number; points: number }>;
    const missing = loc.enabledCurrencies.filter((c) => !rates[c]);
    if (missing.length > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `LOYALTY_RATE_MISSING:${missing.join(",")}`,
      });
    }

    const changes: LoyaltyModeChange[] = [];
    if (earnsPoints(before.mode) && !earnsPoints(input.mode)) changes.push("points-paused");
    if (!earnsPoints(before.mode) && earnsPoints(input.mode)) changes.push("points-resumed");
    if (earnsStamps(before.mode) && !earnsStamps(input.mode)) changes.push("stamps-paused");
    if (!earnsStamps(before.mode) && earnsStamps(input.mode)) changes.push("stamps-resumed");

    await this.repo.upsertSettings(orgId, {
      loyaltyMode: input.mode,
      pointsRates: rates,
      ...(input.pointsCardTemplate !== undefined
        ? { pointsCardTemplate: input.pointsCardTemplate }
        : {}),
      ...(changes.includes("points-resumed")
        ? { tierGraceUntil: new Date(Date.now() + TIER_GRACE_DAYS * 24 * 60 * 60 * 1000) }
        : {}),
    });
    await invalidateLoyaltyConfig(orgId);

    if (changes.length > 0) {
      // Best-effort: a dead queue must not block saving the config.
      await tasks
        .trigger("announce-loyalty-mode", { organizationId: orgId, changes })
        .catch(() => {});
    }
    return this.loyaltyConfigAdmin(orgId);
  }

  // ── Stamps config ──────────────────────────────────────────────────────────

  /** Admin editor state: raw copy (all locales), link health, picker options. */
  async stampsConfigAdmin(orgId: string): Promise<StampsConfigAdminView> {
    const [row, loc, rewardOptions] = await Promise.all([
      this.repo.get(orgId),
      getLocalization(this.db, orgId),
      this.repo.stampsRewardOptions(orgId),
    ]);
    const savedRewardId = row?.stampsCardRewardId ?? null;
    const linkedReward = savedRewardId
      ? await this.repo.getReward(orgId, savedRewardId)
      : null;
    const healthy =
      linkedReward?.status === "published" && linkedReward.stampsRequired != null;
    // Seed a visible 0 ("no minimum") for every enabled currency, like rates.
    const minAmount = Object.fromEntries(
      loc.enabledCurrencies.map((c) => [c, row?.stampMinAmount?.[c] ?? 0]),
    );
    return {
      cardRewardId: savedRewardId,
      brokenLink: savedRewardId != null && !healthy,
      goal: healthy ? linkedReward.stampsRequired! : DEFAULT_STAMPS_GOAL,
      purchasesPerStamp: row?.purchasesPerStamp ?? 1,
      minAmount,
      categoryIds: row?.stampCategoryIds ?? [],
      template: row?.stampsCardTemplate ?? "classic",
      style: row?.stampStyle ?? null,
      copy: row?.stampsCardCopy ?? {},
      linkedReward: linkedReward
        ? {
            id: linkedReward.id,
            name: linkedReward.name,
            stampsRequired: linkedReward.stampsRequired,
            status: linkedReward.status,
          }
        : null,
      rewardOptions,
    };
  }

  /**
   * Save the stamps config. The goal is written onto the linked reward's
   * `stampsRequired` (single source of truth). Lowering the effective goal (or
   * relinking) enqueues the re-evaluation job so customers already at the new
   * goal get their availability armed without waiting for a purchase; raising
   * it never revokes anything.
   */
  async updateStampsConfig(
    orgId: string,
    input: UpdateStampsConfigInput,
  ): Promise<StampsConfigAdminView> {
    validateStampCopy(input.copy as StampCardCopy);

    if (input.cardRewardId) {
      const rw = await this.repo.getReward(orgId, input.cardRewardId);
      if (!rw || rw.status !== "published") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "STAMPS_REWARD_INVALID",
        });
      }
    }

    const before = await getLoyaltyConfig(this.db, orgId);
    if (input.cardRewardId) {
      await this.repo.setRewardStampsRequired(orgId, input.cardRewardId, input.goal);
    }
    await this.repo.upsertSettings(orgId, {
      stampsCardRewardId: input.cardRewardId,
      purchasesPerStamp: input.purchasesPerStamp,
      stampMinAmount: input.minAmount as Record<string, number>,
      stampCategoryIds: input.categoryIds,
      stampsCardTemplate: input.template,
      stampStyle: input.style,
      stampsCardCopy: input.copy as StampCardCopy,
    });
    await invalidateLoyaltyConfig(orgId);

    if (shouldReevaluateStampGoal(before.stamps, input)) {
      // Best-effort: a dead queue must not block saving the config.
      await tasks
        .trigger("reevaluate-stamp-goal", {
          organizationId: orgId,
          rewardId: input.cardRewardId,
        })
        .catch(() => {});
    }
    return this.stampsConfigAdmin(orgId);
  }

  /** Static inputs for the live equivalence panel (math runs client-side). */
  async loyaltyInsights(orgId: string): Promise<LoyaltyInsights> {
    const loc = await getLocalization(this.db, orgId);
    const [ticketByCurrency, pointsRewards, multiplierPromos] = await Promise.all([
      this.repo.avgTicketByCurrency(orgId),
      this.repo.pointsRewards(orgId),
      this.repo.multiplierPromos(orgId),
    ]);
    const perCurrency = await Promise.all(
      loc.enabledCurrencies.map(async (currency) => {
        const fromSales = ticketByCurrency.get(currency);
        if (fromSales != null && fromSales > 0) {
          return { currency, avgTicketCents: fromSales, source: "purchases" as const };
        }
        const fromCatalog = await this.repo.catalogAvgPrice(
          orgId,
          currency,
          currency === loc.defaultCurrency,
        );
        return { currency, avgTicketCents: fromCatalog, source: "catalog" as const };
      }),
    );
    return { perCurrency, pointsRewards, multiplierPromos };
  }
}
