import type { PromoRow } from "@loyalty/db/schema";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { WizardStep, type WizardContext } from "../_shared/wizard";
import type { PromoRepository } from "./repository";
import { benefitConfigSchema, compileRule, type BenefitConfig } from "./rule-compile";
import {
  audienceTypeSchema,
  conditionsSchema,
  promoTypeSchema,
  scheduleSchema,
  tierKeySchema,
} from "./schemas";

export interface PromoStepServices {
  repo: PromoRepository;
}

type Ctx = WizardContext<PromoStepServices>;

// ── 1. Essence: name + curated type ─────────────────────────────────────────
const essenceInputSchema = z.object({
  name: z.string().min(1).max(120),
  type: promoTypeSchema,
});
export type EssenceInput = z.infer<typeof essenceInputSchema>;

export class EssenceStep extends WizardStep<PromoRow, EssenceInput, PromoStepServices> {
  readonly key = "essence";
  readonly schema = essenceInputSchema;

  isComplete(draft: PromoRow): boolean {
    return Boolean(draft.name && draft.type);
  }

  async persist(ctx: Ctx, draft: PromoRow, input: EssenceInput): Promise<PromoRow> {
    const typeChanged = draft.type !== null && draft.type !== input.type;
    const slug =
      draft.slug == null || draft.slug.startsWith("borrador-")
        ? await ctx.services.repo.uniqueSlug(ctx.organizationId, input.name, draft.id)
        : undefined;
    return ctx.services.repo.patch(ctx.organizationId, draft.id, {
      name: input.name,
      type: input.type,
      seoTitle: input.name,
      ...(slug ? { slug } : {}),
      // Changing the type invalidates the benefit config; everything else survives.
      ...(typeChanged ? { rule: null } : {}),
    });
  }
}

// ── 2. Benefit: per-type config compiled into the generic rule ──────────────
export class BenefitStep extends WizardStep<PromoRow, BenefitConfig, PromoStepServices> {
  readonly key = "benefit";
  readonly schema = benefitConfigSchema;

  override canEnter(draft: PromoRow): boolean {
    return Boolean(draft.type);
  }

  isComplete(draft: PromoRow): boolean {
    return draft.rule !== null;
  }

  async persist(ctx: Ctx, draft: PromoRow, input: BenefitConfig): Promise<PromoRow> {
    if (input.type !== draft.type) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Benefit config type does not match the promo type",
      });
    }
    return ctx.services.repo.patch(ctx.organizationId, draft.id, {
      rule: compileRule(input),
    });
  }
}

// ── 3. Conditions: limits + audience + validity window + schedule ───────────
const conditionsInputSchema = z
  .object({
    conditions: conditionsSchema,
    audienceType: audienceTypeSchema,
    tierKey: tierKeySchema.nullish(),
    audienceCustomerIds: z.array(z.string().min(1)).nullish(),
    storeIds: z.array(z.string()).nullable().optional(),
    startsAt: z.coerce.date().nullish(),
    endsAt: z.coerce.date().nullish(),
    schedule: scheduleSchema.nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.audienceType === "tier" && !v.tierKey)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "tierKey required", path: ["tierKey"] });
    if (v.audienceType === "specific" && !(v.audienceCustomerIds?.length ?? 0))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "audienceCustomerIds required",
        path: ["audienceCustomerIds"],
      });
    if (v.startsAt && v.endsAt && v.endsAt <= v.startsAt)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endsAt must be after startsAt",
        path: ["endsAt"],
      });
  });
export type ConditionsInput = z.infer<typeof conditionsInputSchema>;

export class ConditionsStep extends WizardStep<PromoRow, ConditionsInput, PromoStepServices> {
  readonly key = "conditions";
  readonly schema = conditionsInputSchema;

  override canEnter(draft: PromoRow): boolean {
    return draft.rule !== null;
  }

  /** Everything here is optional, so "visited = complete": persist always
   *  writes at least `{}` into `conditions`. */
  isComplete(draft: PromoRow): boolean {
    return draft.conditions !== null;
  }

  async persist(ctx: Ctx, draft: PromoRow, input: ConditionsInput): Promise<PromoRow> {
    return ctx.services.repo.patch(ctx.organizationId, draft.id, {
      conditions: input.conditions,
      audienceType: input.audienceType,
      tierKey: input.audienceType === "tier" ? (input.tierKey ?? null) : null,
      audienceCustomerIds:
        input.audienceType === "specific" ? (input.audienceCustomerIds ?? null) : null,
      // Empty array = "every store"; normalize it to null so the predicate is simple.
      storeIds: input.storeIds && input.storeIds.length > 0 ? input.storeIds : null,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      schedule: input.schedule ?? null,
    });
  }
}

// ── 4. Design: background + image + badge + copy ────────────────────────────
const designInputSchema = z.object({
  backgroundCss: z.string().min(1).max(4096),
  mainImageUrl: z.string().url().nullish().or(z.literal("")),
  badgeLabel: z.string().max(24).nullish(),
  icon: z.string().max(60).nullish(),
  shortDescription: z.string().max(280).nullish(),
  longDescription: z.string().nullish(),
  category: z.string().max(60).nullish(),
  featured: z.boolean().optional(),
});
export type DesignInput = z.infer<typeof designInputSchema>;

export class DesignStep extends WizardStep<PromoRow, DesignInput, PromoStepServices> {
  readonly key = "design";
  readonly schema = designInputSchema;

  isComplete(draft: PromoRow): boolean {
    return Boolean(draft.backgroundCss);
  }

  async persist(ctx: Ctx, draft: PromoRow, input: DesignInput): Promise<PromoRow> {
    return ctx.services.repo.patch(ctx.organizationId, draft.id, {
      backgroundCss: input.backgroundCss,
      mainImageUrl: input.mainImageUrl || null,
      ogImageUrl: input.mainImageUrl || null,
      badgeLabel: input.badgeLabel ?? null,
      icon: input.icon ?? null,
      shortDescription: input.shortDescription ?? null,
      longDescription: input.longDescription ?? null,
      category: input.category ?? null,
      ...(input.featured !== undefined ? { featured: input.featured } : {}),
      ...(input.shortDescription ? { seoDescription: input.shortDescription } : {}),
    });
  }
}
