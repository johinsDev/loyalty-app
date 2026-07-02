import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";
import { TRPCError } from "@trpc/server";

import { managerProcedure, router } from "../../trpc";
import { CampaignsRepository } from "./repository";
import {
  advanceInputSchema,
  bulkIdsSchema,
  campaignsListInputSchema,
  countReachInputSchema,
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

async function requireOrg(): Promise<string> {
  const organizationId = await getPrimaryOrganizationId();
  if (!organizationId) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No active organization" });
  }
  return organizationId;
}

/**
 * Unified communication hub — campaigns. Server-driven manager wizard
 * (create → getState → advance per step → publish) + admin list/detail with a
 * 3-stage send funnel. Dispatch runs in Trigger.dev (`send-campaign`).
 */
export const campaignsRouter = router({
  create: managerProcedure.mutation(async ({ ctx }) =>
    makeService(ctx.db).create(await requireOrg(), ctx.session.user.id),
  ),
  getState: managerProcedure
    .input(getStateInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).getState(await requireOrg(), input.id),
    ),
  advance: managerProcedure
    .input(advanceInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).advance(
        await requireOrg(),
        ctx.session.user.id,
        input.id,
        input.step,
        input.input,
      ),
    ),
  publish: managerProcedure
    .input(publishInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).publish(await requireOrg(), input.id),
    ),
  adminList: managerProcedure
    .input(campaignsListInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).adminList(await requireOrg(), input),
    ),
  listByIds: managerProcedure
    .input(bulkIdsSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).listByIds(await requireOrg(), input.ids),
    ),
  detail: managerProcedure
    .input(getStateInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).detail(await requireOrg(), input.id),
    ),
  funnel: managerProcedure
    .input(getStateInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).funnel(await requireOrg(), input.id),
    ),
  countReach: managerProcedure
    .input(countReachInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).countReach(await requireOrg(), input),
    ),
  renderPreview: managerProcedure
    .input(renderPreviewInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).renderPreview(await requireOrg(), input),
    ),
  resolveEntities: managerProcedure
    .input(resolveEntitiesInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).resolveEntityNames(await requireOrg(), input.refs),
    ),
  pause: managerProcedure
    .input(pauseInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).pause(await requireOrg(), input.id),
    ),
  resume: managerProcedure
    .input(pauseInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).resume(await requireOrg(), input.id),
    ),
  end: managerProcedure
    .input(pauseInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).end(await requireOrg(), input.id),
    ),
  retry: managerProcedure
    .input(retryInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).retry(await requireOrg(), input.id),
    ),
  remove: managerProcedure
    .input(removeInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).remove(await requireOrg(), input.id),
    ),
  bulkRemove: managerProcedure
    .input(bulkIdsSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).bulkRemove(await requireOrg(), input.ids),
    ),

  // ─── Saved templates (org-scoped reusable messages) ───────────────────────
  templateList: managerProcedure.query(async ({ ctx }) =>
    makeService(ctx.db).listTemplates(await requireOrg()),
  ),
  saveTemplate: managerProcedure
    .input(saveTemplateSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).saveTemplate(await requireOrg(), ctx.session.user.id, input),
    ),
  deleteTemplate: managerProcedure
    .input(deleteTemplateSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).deleteTemplate(await requireOrg(), input.id),
    ),
});
