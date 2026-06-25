import type { BannerRow } from "@loyalty/db/schema";

import { Wizard } from "../_shared/wizard";
import { ContentStep, DesignStep, ScheduleStep, type BannerStepServices } from "./steps";

/**
 * The banner wizard: content → design → schedule. The order here IS the sequence
 * the FE renders. Schedule is always "complete" (optional), so publish unlocks
 * after content + design. See `.claude/skills/wizard/SKILL.md`.
 */
export const bannerWizard = new Wizard<BannerRow, BannerStepServices>([
  new ContentStep(),
  new DesignStep(),
  new ScheduleStep(),
]);
