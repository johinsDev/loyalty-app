import { describe, expect, it } from "vitest";

import { benefitSummary } from "../format";
import { decompileRule } from "../rule-compile";
import { conditionsSchema, promoTypeSchema, ruleSchema, scheduleSchema } from "../schemas";
import { PROMO_TEMPLATES } from "../templates";

describe("PROMO_TEMPLATES", () => {
  it("has unique keys", () => {
    const keys = PROMO_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(PROMO_TEMPLATES.map((t) => [t.key, t] as const))(
    "%s parses against every contract and rehydrates its benefit form",
    (_key, tpl) => {
      expect(promoTypeSchema.parse(tpl.type)).toBe(tpl.type);
      expect(ruleSchema.parse(tpl.rule)).toBeTruthy();
      if (tpl.schedule) expect(scheduleSchema.parse(tpl.schedule)).toBeTruthy();
      if (tpl.conditions) expect(conditionsSchema.parse(tpl.conditions)).toBeTruthy();
      // The benefit step must be able to lift the preseeded rule into its form.
      expect(decompileRule(tpl.type, tpl.rule)).not.toBeNull();
      // And the formatter must produce copy for it in both locales.
      expect(benefitSummary(tpl.type, tpl.rule, "es")).toBeTruthy();
      expect(benefitSummary(tpl.type, tpl.rule, "en")).toBeTruthy();
    },
  );
});
