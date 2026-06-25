export { promocionesRouter } from "./router";
export { PromoRepository, type AdminListResult, type PromoPatch } from "./repository";
export { PromoService } from "./service";
export {
  computeDiscount,
  ineligibleReason,
  isEligible,
  type Cart,
  type CartLine,
} from "./engine";
export {
  benefitSchema,
  conditionsSchema,
  promoTypeSchema,
  scopeSchema,
  type ApplicablePromo,
  type ListInput,
  type PromoCard,
  type PromoDetail,
  type PublicListInput,
  type UpdateInput,
} from "./schemas";
