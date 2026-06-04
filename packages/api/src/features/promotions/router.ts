import { getPrimaryOrganizationId } from "@loyalty/db";
import { TRPCError } from "@trpc/server";

import { managerProcedure, router } from "../../trpc";
import { PromoRepository } from "./repository";
import {
  advanceInputSchema,
  getStateInputSchema,
  listInputSchema,
  publishInputSchema,
} from "./schemas";
import { PromoService } from "./service";
import type { Context } from "../../trpc";

function makeService(db: Context["db"]): PromoService {
  return new PromoService(db, new PromoRepository(db));
}

async function requireOrg(): Promise<string> {
  const organizationId = await getPrimaryOrganizationId();
  if (!organizationId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No active organization",
    });
  }
  return organizationId;
}

/**
 * Server-driven promo wizard. `managerProcedure` — managers + owners build
 * promos. The FE only ever calls `create` once, then loops
 * `getState` → `advance` per step → `publish`. See `.claude/skills/wizard/SKILL.md`.
 */
export const promocionesRouter = router({
  create: managerProcedure.mutation(async ({ ctx }) => {
    const organizationId = await requireOrg();
    return makeService(ctx.db).create(organizationId, ctx.session.user.id);
  }),

  getState: managerProcedure
    .input(getStateInputSchema)
    .query(async ({ ctx, input }) => {
      const organizationId = await requireOrg();
      return makeService(ctx.db).getState(organizationId, input.id);
    }),

  advance: managerProcedure
    .input(advanceInputSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = await requireOrg();
      return makeService(ctx.db).advance(
        organizationId,
        ctx.session.user.id,
        input.id,
        input.step,
        input.input,
      );
    }),

  publish: managerProcedure
    .input(publishInputSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = await requireOrg();
      return makeService(ctx.db).publish(organizationId, input.id);
    }),

  list: managerProcedure
    .input(listInputSchema)
    .query(async ({ ctx, input }) => {
      const organizationId = await requireOrg();
      return makeService(ctx.db).list(organizationId, input);
    }),
});
