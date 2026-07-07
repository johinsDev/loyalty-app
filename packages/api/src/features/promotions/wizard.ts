import type { PromoRow } from "@loyalty/db/schema";

import { Wizard } from "../_shared/wizard";
import {
  BenefitStep,
  ConditionsStep,
  DesignStep,
  EssenceStep,
  type PromoStepServices,
} from "./steps";

/** essence → benefit → conditions → design (+ client-side broadcast + review).
 *  The broadcast step is intentionally NOT a server step: it's optional and
 *  fires `campaigns.createFromEntity` from the client at publish time, exactly
 *  like the banner wizard's Difusión step. */
export const promoWizard = new Wizard<PromoRow, PromoStepServices>([
  new EssenceStep(),
  new BenefitStep(),
  new ConditionsStep(),
  new DesignStep(),
]);
