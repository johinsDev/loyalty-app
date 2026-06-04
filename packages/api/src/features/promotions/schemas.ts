import { z } from "zod";

/** Promo lifecycle status. */
export const promoStatusSchema = z.enum(["draft", "published"]);

// ─── Per-step input schemas (reused verbatim by the FE forms) ────────────────
// Each maps 1:1 to a `WizardStep.schema`. Keep them flat so RHF binds directly.

export const segmentStepSchema = z.object({
  name: z.string().min(1).max(120),
  segmentId: z.string().min(1),
});
export const productsStepSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1),
});
export const brandingStepSchema = z.object({
  icon: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a #RRGGBB hex color"),
});
export const scheduleStepSchema = z
  .object({
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((v) => v.endsAt > v.startsAt, {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  });

export type SegmentStepInput = z.infer<typeof segmentStepSchema>;
export type ProductsStepInput = z.infer<typeof productsStepSchema>;
export type BrandingStepInput = z.infer<typeof brandingStepSchema>;
export type ScheduleStepInput = z.infer<typeof scheduleStepSchema>;

/** Ordered step keys. The FE renders the component matching `state.current`. */
export const PROMO_STEP_KEYS = [
  "segment",
  "products",
  "branding",
  "schedule",
] as const;
export type PromoStepKey = (typeof PROMO_STEP_KEYS)[number];

// ─── Router IO ───────────────────────────────────────────────────────────────
export const getStateInputSchema = z.object({ id: z.string().uuid() });
export const publishInputSchema = z.object({ id: z.string().uuid() });
export const advanceInputSchema = z.object({
  id: z.string().uuid(),
  step: z.enum(PROMO_STEP_KEYS),
  // Validated by the step's own schema inside the wizard — kept opaque here so
  // the dispatcher stays generic.
  input: z.unknown(),
});
export const listInputSchema = z.object({
  status: promoStatusSchema.optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});
export type ListInput = z.infer<typeof listInputSchema>;
