import { type db as Db } from "@loyalty/db";

import { managerProcedure, requireOrg, router } from "../../trpc";
import { cachedListRead } from "../_shared/list-cache";
import { CampaignsRepository } from "./repository";
import {
  advanceInputSchema,
  bulkIdsSchema,
  campaignAnalyticsInputSchema,
  campaignSourceSchema,
  campaignsListInputSchema,
  campaignTimeseriesInputSchema,
  countReachInputSchema,
  createFromEntityInputSchema,
  deleteTemplateSchema,
  getStateInputSchema,
  pauseInputSchema,
  publishInputSchema,
  removeInputSchema,
  renderPreviewInputSchema,
  resolveEntitiesInputSchema,
  retryInputSchema,
  saveTemplateSchema,
} from "./schemas";
import { CampaignsService } from "./service";

function makeService(db: typeof Db): CampaignsService {
  return new CampaignsService(db, new CampaignsRepository(db));
}

/**
 * Unified communication hub — campaigns. Server-driven manager wizard
 * (create → getState → advance per step → publish) + admin list/detail with a
 * 3-stage send funnel. Dispatch runs in Trigger.dev (`send-campaign`).
 */
export const campaignsRouter = router({
  create: managerProcedure.mutation(async ({ ctx }) =>
    makeService(ctx.db).create(requireOrg(ctx), ctx.session.user.id),
  ),
  getState: managerProcedure
    .input(getStateInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).getState(requireOrg(ctx), input.id),
    ),
  advance: managerProcedure
    .input(advanceInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).advance(
        requireOrg(ctx),
        ctx.session.user.id,
        input.id,
        input.step,
        input.input,
      ),
    ),
  publish: managerProcedure
    .input(publishInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).publish(requireOrg(ctx), input.id),
    ),
  createFromEntity: managerProcedure
    .input(createFromEntityInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).createFromEntity(requireOrg(ctx), ctx.session.user.id, input),
    ),
  campaignsBySource: managerProcedure
    .input(campaignSourceSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).campaignsBySource(requireOrg(ctx), input),
    ),
  adminList: managerProcedure
    .input(campaignsListInputSchema)
    .query(async ({ ctx, input }) => {
      const org = requireOrg(ctx);
      return cachedListRead(ctx, "campaigns", org, input, () =>
        makeService(ctx.db).adminList(org, input),
      );
    }),
  listByIds: managerProcedure
    .input(bulkIdsSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).listByIds(requireOrg(ctx), input.ids),
    ),
  detail: managerProcedure
    .input(getStateInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).detail(requireOrg(ctx), input.id),
    ),
  funnel: managerProcedure
    .input(getStateInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).funnel(requireOrg(ctx), input.id),
    ),
  countReach: managerProcedure
    .input(countReachInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).countReach(requireOrg(ctx), input),
    ),
  renderPreview: managerProcedure
    .input(renderPreviewInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).renderPreview(requireOrg(ctx), input),
    ),
  resolveEntities: managerProcedure
    .input(resolveEntitiesInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).resolveEntityNames(requireOrg(ctx), input.refs),
    ),
  analytics: managerProcedure
    .input(campaignAnalyticsInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).analytics(requireOrg(ctx), input),
    ),
  timeseries: managerProcedure
    .input(campaignTimeseriesInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).timeseries(requireOrg(ctx), input.id),
    ),
  pause: managerProcedure
    .input(pauseInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).pause(requireOrg(ctx), input.id),
    ),
  resume: managerProcedure
    .input(pauseInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).resume(requireOrg(ctx), input.id),
    ),
  end: managerProcedure
    .input(pauseInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).end(requireOrg(ctx), input.id),
    ),
  retry: managerProcedure
    .input(retryInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).retry(requireOrg(ctx), input.id),
    ),
  remove: managerProcedure
    .input(removeInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).remove(requireOrg(ctx), input.id),
    ),
  bulkRemove: managerProcedure
    .input(bulkIdsSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).bulkRemove(requireOrg(ctx), input.ids),
    ),

  // ─── Saved templates (org-scoped reusable messages) ───────────────────────
  templateList: managerProcedure.query(async ({ ctx }) =>
    makeService(ctx.db).listTemplates(requireOrg(ctx)),
  ),
  saveTemplate: managerProcedure
    .input(saveTemplateSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).saveTemplate(requireOrg(ctx), ctx.session.user.id, input),
    ),
  deleteTemplate: managerProcedure
    .input(deleteTemplateSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).deleteTemplate(requireOrg(ctx), input.id),
    ),
});
