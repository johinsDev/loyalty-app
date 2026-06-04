import type { PromoRow } from "@loyalty/db/schema";

import { Wizard } from "../_shared/wizard";
import {
  BrandingStep,
  ProductsStep,
  ScheduleStep,
  SegmentStep,
  type PromoStepServices,
} from "./steps";

/**
 * The promo wizard: ordered steps the backend walks to drive the create/edit
 * flow. The order here IS the sequence the FE renders. See
 * `.claude/skills/wizard/SKILL.md`.
 */
export const promoWizard = new Wizard<PromoRow, PromoStepServices>([
  new SegmentStep(),
  new ProductsStep(),
  new BrandingStep(),
  new ScheduleStep(),
]);
