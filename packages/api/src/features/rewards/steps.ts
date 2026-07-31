import type { RewardRow } from "@loyalty/db/schema";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { WizardStep, type WizardContext } from "../_shared/wizard";
import { PromoRepository } from "../promotions";
import { compileRewardRule } from "./benefit";
import type { RewardsRepository } from "./repository";
import {
  rewardBenefitConfigSchema,
  rewardCostInputSchema,
  rewardTypeSchema,
  type RewardBenefitConfigInput,
  type RewardCostInput,
} from "./schemas";

export interface RewardStepServices {
  repo: RewardsRepository;
  /** Reads the catalog's option graph, so the benefit step can prove a size
   *  upgrade resolves to at least one real product before persisting it. */
  promoRepo: PromoRepository;
}
type Ctx = WizardContext<RewardStepServices>;

// ── 1. Essence: name + type ─────────────────────────────────────────────────
const essenceInputSchema = z.object({
  name: z.string().min(1).max(120),
  type: rewardTypeSchema,
});
export type RewardEssenceInput = z.infer<typeof essenceInputSchema>;

export class EssenceStep extends WizardStep<RewardRow, RewardEssenceInput, RewardStepServices> {
  readonly key = "essence";
  readonly schema = essenceInputSchema;

  isComplete(draft: RewardRow): boolean {
    return Boolean(draft.name && draft.name !== DRAFT_NAME && draft.type);
  }

  async persist(ctx: Ctx, draft: RewardRow, input: RewardEssenceInput): Promise<RewardRow> {
    const typeChanged = draft.type !== null && draft.type !== input.type;
    return ctx.services.repo.patch(ctx.organizationId, draft.id, {
      name: input.name,
      type: input.type,
      // Changing the type invalidates the benefit config; everything else survives.
      ...(typeChanged ? { benefit: null } : {}),
    });
  }
}

// ── 2. Benefit: per-type config (compiled to a rule at POS) ─────────────────
export class BenefitStep extends WizardStep<RewardRow, RewardBenefitConfigInput, RewardStepServices> {
  readonly key = "benefit";
  readonly schema = rewardBenefitConfigSchema;

  override canEnter(draft: RewardRow): boolean {
    return Boolean(draft.type);
  }

  isComplete(draft: RewardRow): boolean {
    // Not just "present": `createDraft` writes a template's benefit straight to
    // the column without Zod, and the `freeProduct` templates carry `refs: []`,
    // which the schema rejects. Checking presence alone let the wizard skip this
    // step and publish a reward with no product picked — and empty refs match
    // ANY product unit.
    return draft.benefit !== null && rewardBenefitConfigSchema.safeParse(draft.benefit).success;
  }

  async persist(ctx: Ctx, draft: RewardRow, input: RewardBenefitConfigInput): Promise<RewardRow> {
    if (input.type !== draft.type) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Benefit config type does not match the reward type",
      });
    }
    // Validate the config compiles (experience → null is fine).
    compileRewardRule(input);
    // A size upgrade is three labels matched against a free-text, per-product
    // vocabulary — so prove against the catalog that at least one product can
    // actually be upgraded, rather than persisting a reward that silently never
    // applies.
    if (input.type === "variantUpgrade") {
      const view = await ctx.services.promoRepo.variantAxes(ctx.organizationId, input.refs, {
        optionName: input.optionName,
        fromValueLabel: input.fromValueLabel,
        toValueLabel: input.toValueLabel,
      });
      if (!view.pair || view.pair.eligibleCount === 0) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "upgrade-no-eligible-product" });
      }
    }
    return ctx.services.repo.patch(ctx.organizationId, draft.id, { benefit: input });
  }
}

// ── 3. Cost & eligibility ───────────────────────────────────────────────────
export class CostStep extends WizardStep<RewardRow, RewardCostInput, RewardStepServices> {
  readonly key = "cost";
  readonly schema = rewardCostInputSchema;

  override canEnter(draft: RewardRow): boolean {
    return draft.benefit !== null;
  }

  isComplete(draft: RewardRow): boolean {
    return draft.stampsRequired != null || draft.pointsCost != null;
  }

  async persist(ctx: Ctx, draft: RewardRow, input: RewardCostInput): Promise<RewardRow> {
    return ctx.services.repo.patch(ctx.organizationId, draft.id, {
      stampsRequired: input.stampsRequired ?? null,
      pointsCost: input.pointsCost ?? null,
      costMode: input.costMode,
      allowedTiers: input.allowedTiers ?? null,
      limitPerCustomer: input.limitPerCustomer,
      sections: input.sections,
      sortOrder: input.sortOrder,
      // Empty selection = available at every store → normalize to null.
      storeIds: input.storeIds && input.storeIds.length > 0 ? input.storeIds : null,
    });
  }
}

// ── 4. Design: bg + emoji + image + copy (+ fulfillment note) ────────────────
const designInputSchema = z.object({
  backgroundCss: z.string().min(1).max(4096),
  imageUrl: z.string().url().nullish().or(z.literal("")),
  icon: z.string().max(60).nullish(),
  description: z.string().nullish(),
  fulfillmentNote: z.string().max(280).nullish(),
});
export type RewardDesignInput = z.infer<typeof designInputSchema>;

export class DesignStep extends WizardStep<RewardRow, RewardDesignInput, RewardStepServices> {
  readonly key = "design";
  readonly schema = designInputSchema;

  override canEnter(draft: RewardRow): boolean {
    return draft.stampsRequired != null || draft.pointsCost != null;
  }

  isComplete(draft: RewardRow): boolean {
    return Boolean(draft.backgroundCss);
  }

  async persist(ctx: Ctx, draft: RewardRow, input: RewardDesignInput): Promise<RewardRow> {
    return ctx.services.repo.patch(ctx.organizationId, draft.id, {
      backgroundCss: input.backgroundCss,
      imageUrl: input.imageUrl || null,
      icon: input.icon ?? null,
      description: input.description ?? null,
      fulfillmentNote: input.fulfillmentNote ?? null,
    });
  }
}

/** Placeholder name a fresh draft carries until the essence step overwrites it
 *  (reward.name is NOT NULL). */
export const DRAFT_NAME = "Borrador";
