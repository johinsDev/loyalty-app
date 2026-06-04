import type { PromoRow } from "@loyalty/db/schema";

import { WizardStep, type WizardContext } from "../_shared/wizard";
import type { PromoRepository } from "./repository";
import {
  brandingStepSchema,
  productsStepSchema,
  scheduleStepSchema,
  segmentStepSchema,
  type BrandingStepInput,
  type ProductsStepInput,
  type ScheduleStepInput,
  type SegmentStepInput,
} from "./schemas";

/** Services a promo step may reach — the feature's own repo (and, in a richer
 *  build, a segments/catalog service for cross-validation). */
export interface PromoStepServices {
  repo: PromoRepository;
}
type Ctx = WizardContext<PromoStepServices>;

// `isComplete` is derived from the row's columns — no stored "current step".
// `persist` writes only this step's slice via the repo.

export class SegmentStep extends WizardStep<
  PromoRow,
  SegmentStepInput,
  PromoStepServices
> {
  readonly key = "segment";
  readonly schema = segmentStepSchema;
  isComplete(d: PromoRow) {
    return d.name != null && d.segmentId != null;
  }
  persist(ctx: Ctx, d: PromoRow, input: SegmentStepInput) {
    return ctx.services.repo.patch(ctx.organizationId, d.id, {
      name: input.name,
      segmentId: input.segmentId,
    });
  }
}

export class ProductsStep extends WizardStep<
  PromoRow,
  ProductsStepInput,
  PromoStepServices
> {
  readonly key = "products";
  readonly schema = productsStepSchema;
  // Gate: can't pick products before the segment is set.
  override canEnter(d: PromoRow) {
    return d.name != null && d.segmentId != null;
  }
  isComplete(d: PromoRow) {
    return Array.isArray(d.productIds) && d.productIds.length > 0;
  }
  persist(ctx: Ctx, d: PromoRow, input: ProductsStepInput) {
    return ctx.services.repo.patch(ctx.organizationId, d.id, {
      productIds: input.productIds,
    });
  }
}

export class BrandingStep extends WizardStep<
  PromoRow,
  BrandingStepInput,
  PromoStepServices
> {
  readonly key = "branding";
  readonly schema = brandingStepSchema;
  isComplete(d: PromoRow) {
    return d.branding != null;
  }
  persist(ctx: Ctx, d: PromoRow, input: BrandingStepInput) {
    return ctx.services.repo.patch(ctx.organizationId, d.id, {
      branding: { icon: input.icon, color: input.color },
    });
  }
}

export class ScheduleStep extends WizardStep<
  PromoRow,
  ScheduleStepInput,
  PromoStepServices
> {
  readonly key = "schedule";
  readonly schema = scheduleStepSchema;
  isComplete(d: PromoRow) {
    return d.startsAt != null && d.endsAt != null;
  }
  persist(ctx: Ctx, d: PromoRow, input: ScheduleStepInput) {
    return ctx.services.repo.patch(ctx.organizationId, d.id, {
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });
  }
}
