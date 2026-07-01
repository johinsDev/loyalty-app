import type { CampaignRow } from "@loyalty/db/schema";

import { Wizard } from "../_shared/wizard";
import {
  AudienceStep,
  ChannelsStep,
  DefinitionStep,
  MessageStep,
  ScheduleStep,
  type CampaignStepServices,
} from "./steps";

/**
 * The campaign wizard: definition → message → channels → audience → schedule.
 * The order here IS the sequence the FE renders (the last two steps are
 * optional/always-complete, so publish unlocks after definition + message +
 * channels). See `.claude/skills/wizard/SKILL.md`.
 */
export const campaignWizard = new Wizard<CampaignRow, CampaignStepServices>([
  new DefinitionStep(),
  new MessageStep(),
  new ChannelsStep(),
  new AudienceStep(),
  new ScheduleStep(),
]);
