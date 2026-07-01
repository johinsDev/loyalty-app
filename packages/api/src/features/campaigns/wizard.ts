import type { CampaignRow } from "@loyalty/db/schema";

import { Wizard } from "../_shared/wizard";
import {
  AudienceStep,
  DefinitionStep,
  MessageStep,
  ScheduleStep,
  type CampaignStepServices,
} from "./steps";

/**
 * The campaign wizard: definition → message → audience → schedule. The message
 * step also captures the channel priority (folded in from the old standalone
 * "channels" step). The order here IS the sequence the FE renders (the last two
 * steps are optional/always-complete, so publish unlocks after definition +
 * message). See `.claude/skills/wizard/SKILL.md`.
 */
export const campaignWizard = new Wizard<CampaignRow, CampaignStepServices>([
  new DefinitionStep(),
  new MessageStep(),
  new AudienceStep(),
  new ScheduleStep(),
]);
