import type { RewardRow } from "@loyalty/db/schema";

import { Wizard } from "../_shared/wizard";
import {
  BenefitStep,
  CostStep,
  DesignStep,
  EssenceStep,
  type RewardStepServices,
} from "./steps";

/** essence → benefit → cost & eligibility → design (+ client-side broadcast +
 *  review). Broadcast fires `campaigns.createFromEntity` (scope "reward") at
 *  publish, like the promo/banner wizards. */
export const rewardWizard = new Wizard<RewardRow, RewardStepServices>([
  new EssenceStep(),
  new BenefitStep(),
  new CostStep(),
  new DesignStep(),
]);
