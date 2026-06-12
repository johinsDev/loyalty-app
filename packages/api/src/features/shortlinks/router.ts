import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";
import { TRPCError } from "@trpc/server";

import { ownerProcedure, router, staffProcedure } from "../../trpc";
import { ShortlinkRepository } from "./repository";
import {
  analyticsInputSchema,
  createInputSchema,
  idInputSchema,
  listInputSchema,
} from "./schemas";
import { ShortlinkService } from "./service";

/** The single principal org (single-tenant pilot). No env var needed. */
const orgId = async (): Promise<string> =>
  (await getPrimaryOrganizationId()) ?? "";

function buildService(db: typeof Db, baseUrl: string): ShortlinkService {
  return new ShortlinkService(new ShortlinkRepository(db), baseUrl);
}

/**
 * Admin shortlink CRUD + analytics. Reads are `staffProcedure`; the
 * destructive `deactivate` is `ownerProcedure`. `create` delegates to
 * `ctx.shortlinks` (the manager) so slug-gen + dedupe live in the
 * provider; the persisted row is then returned with its short URL. The
 * redirect itself is a raw Hono route on the Worker, not here.
 */
export const shortlinksRouter = router({
  create: staffProcedure
    .input(createInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.shortlinks) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "shortlinks provider is not configured on this server",
        });
      }
      const organizationId = await orgId();
      const result = await ctx.shortlinks.shorten(input.targetUrl, {
        organizationId,
        slug: input.slug,
        expiresAt: input.expiresAt,
        createdByUserId: ctx.session.user.id,
      });
      const repo = new ShortlinkRepository(ctx.db);
      const row = await repo.findBySlug(organizationId, result.slug ?? "");
      if (!row) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "shortlink was not persisted",
        });
      }
      return new ShortlinkService(repo, ctx.shortlinkBaseUrl ?? "").present(row);
    }),

  list: staffProcedure
    .input(listInputSchema)
    .query(async ({ ctx, input }) =>
      buildService(ctx.db, ctx.shortlinkBaseUrl ?? "").list(
        await orgId(),
        input,
      ),
    ),

  get: staffProcedure
    .input(idInputSchema)
    .query(async ({ ctx, input }) =>
      buildService(ctx.db, ctx.shortlinkBaseUrl ?? "").get(
        await orgId(),
        input.id,
      ),
    ),

  analytics: staffProcedure
    .input(analyticsInputSchema)
    .query(async ({ ctx, input }) =>
      buildService(ctx.db, ctx.shortlinkBaseUrl ?? "").analytics(
        await orgId(),
        input,
      ),
    ),

  deactivate: ownerProcedure
    .input(idInputSchema)
    .mutation(async ({ ctx, input }) =>
      buildService(ctx.db, ctx.shortlinkBaseUrl ?? "").deactivate(
        await orgId(),
        input.id,
      ),
    ),
});
