export { promocionesRouter } from "./router";
export { PromoRepository, collectRefs, type AdminPromoRow, type PromoPatch } from "./repository";
export { PromoService, type PromoWizardResult } from "./service";
export {
  evaluatePromo,
  ineligibleReason,
  isEligible,
  pickBest,
  subtotalCents,
  type Cart,
  type CartLine,
  type CustomerFacts,
  type IneligibleReason,
  type PromoEvaluation,
  type PromoView,
  type UnitExclusion,
} from "./engine";
export { benefitConfigSchema, compileRule, decompileRule, type BenefitConfig } from "./rule-compile";
export { benefitSummary, type SummaryLocale } from "./format";
export { PROMO_TEMPLATES, promoTemplate, type PromoTemplate } from "./templates";
export {
  adminListInputSchema,
  conditionsSchema,
  itemRefSchema,
  promoAnalyticsInputSchema,
  promoStatusSchema,
  promoTypeSchema,
  ruleSchema,
  scheduleSchema,
  type AdminListInput,
  type ApplicableHint,
  type ApplicablePromo,
  type ApplicableResult,
  type ConditionsInput,
  type ItemRef,
  type PromoAnalytics,
  type PromoAnalyticsRow,
  type PromoCard,
  type PromoDetail,
  type PromoStatPoint,
  type PromoStats,
  type PromoType,
  type PromoUpsellHint,
  type PromoWeekdayPoint,
  type PublicListInput,
  type RuleInput,
  type ScheduleInput,
} from "./schemas";
