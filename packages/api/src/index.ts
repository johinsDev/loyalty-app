export { baseProperties, resolveDistinctId } from "./analytics";
export { appRouter, type AppRouter } from "./routers/_app";
export { type CaptureError, createContext, type Context } from "./trpc";
// Wizard step schemas — shared verbatim with the FE forms (zod skill).
export {
  PROMO_STEP_KEYS,
  brandingStepSchema,
  productsStepSchema,
  scheduleStepSchema,
  segmentStepSchema,
  type BrandingStepInput,
  type ProductsStepInput,
  type PromoStepKey,
  type ScheduleStepInput,
  type SegmentStepInput,
} from "./features/promotions";
export type { WizardState } from "./features/_shared/wizard";
