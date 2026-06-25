import type { BannerRow } from "@loyalty/db/schema";

import { WizardStep, type WizardContext } from "../_shared/wizard";
import type { BannersRepository } from "./repository";
import {
  contentStepSchema,
  designStepSchema,
  scheduleStepSchema,
  type ContentStepInput,
  type DesignStepInput,
  type ScheduleStepInput,
} from "./schemas";

export interface BannerStepServices {
  repo: BannersRepository;
}
type Ctx = WizardContext<BannerStepServices>;

const isExternal = (href: string) => /^https?:\/\//i.test(href);

export class ContentStep extends WizardStep<
  BannerRow,
  ContentStepInput,
  BannerStepServices
> {
  readonly key = "content";
  readonly schema = contentStepSchema;
  isComplete(d: BannerRow) {
    return d.shortDescription != null && d.shortDescription !== "";
  }
  async persist(ctx: Ctx, d: BannerRow, input: ContentStepInput) {
    const slug = await ctx.services.repo.uniqueSlug(
      ctx.organizationId,
      input.slug,
      d.id,
    );
    const ctaHref = input.ctaHref?.trim() || null;
    const ctaKind = ctaHref
      ? (input.ctaKind ?? (isExternal(ctaHref) ? "external" : "internal"))
      : null;
    return ctx.services.repo.patch(ctx.organizationId, d.id, {
      name: input.name,
      slug,
      shortDescription: input.shortDescription,
      longDescription: input.longDescription ?? null,
      ctaLabel: ctaHref ? (input.ctaLabel ?? null) : null,
      ctaHref,
      ctaKind,
      seoTitle: input.name,
      seoDescription: input.shortDescription,
    });
  }
}

export class DesignStep extends WizardStep<
  BannerRow,
  DesignStepInput,
  BannerStepServices
> {
  readonly key = "design";
  readonly schema = designStepSchema;
  isComplete(d: BannerRow) {
    return d.backgroundCss != null && d.backgroundCss !== "";
  }
  persist(ctx: Ctx, d: BannerRow, input: DesignStepInput) {
    const mainImageUrl = input.mainImageUrl?.trim() ? input.mainImageUrl : null;
    return ctx.services.repo.patch(ctx.organizationId, d.id, {
      backgroundCss: input.backgroundCss,
      mainImageUrl,
      mainImageBlur: input.mainImageBlur ?? null,
      ogImageUrl: mainImageUrl,
    });
  }
}

export class ScheduleStep extends WizardStep<
  BannerRow,
  ScheduleStepInput,
  BannerStepServices
> {
  readonly key = "schedule";
  readonly schema = scheduleStepSchema;
  // Optional config — always "complete" so it never blocks publish (the window
  // and notifications are opt-in). Still visitable from the stepper.
  isComplete(_d: BannerRow) {
    return true;
  }
  persist(ctx: Ctx, d: BannerRow, input: ScheduleStepInput) {
    return ctx.services.repo.patch(ctx.organizationId, d.id, {
      displayFrom: input.displayFrom ?? null,
      displayUntil: input.displayUntil ?? null,
    });
  }
}
