import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";
import { TRPCError } from "@trpc/server";

import {
  managerProcedure,
  ownerProcedure,
  protectedProcedure,
  publicProcedure,
  router,
  staffProcedure,
} from "../../trpc";
import { EmployeesRepository } from "./repository";
import {
  acceptInviteSchema,
  bulkIdsSchema,
  bulkSetDisabledSchema,
  changeEmailSchema,
  disableEmployeeSchema,
  employeeActivityInputSchema,
  employeesListInputSchema,
  impersonateSchema,
  leaderboardInputSchema,
  inviteEmployeeSchema,
  memberIdSchema,
  revokeSessionSchema,
  setRatingSchema,
  updateEmployeeSchema,
} from "./schemas";
import { type Actor, EmployeesService } from "./service";

/** Default operating timezone for monthly stats (the single-location pilot). */
const STATS_TZ = "America/Bogota";

function makeService(db: typeof Db): EmployeesService {
  return new EmployeesService(new EmployeesRepository(db));
}

async function requireOrg(): Promise<string> {
  const id = await getPrimaryOrganizationId();
  if (!id) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No active organization" });
  }
  return id;
}

function actorOf(ctx: { session: { user: { id: string } }; headers: Headers }): Actor {
  return { userId: ctx.session.user.id, headers: ctx.headers };
}

/**
 * Empleados — staff management over Better Auth member/invitation/user.
 * Reads are manager+ (`managerProcedure`); every mutation + session op is
 * owner-only (`ownerProcedure`). `acceptInvitation` is open to any signed-in
 * user (the invitee isn't staff yet).
 */
export const employeesRouter = router({
  // ── Register store-switcher (any staff) ─────────────────────────────────────
  myStores: staffProcedure.query(async ({ ctx }) =>
    makeService(ctx.db).myStores(await requireOrg(), ctx.session.user.id),
  ),

  // ── Reads (managers + owner) ────────────────────────────────────────────────
  list: managerProcedure
    .input(employeesListInputSchema)
    .query(async ({ ctx, input }) => makeService(ctx.db).list(await requireOrg(), input)),
  listByIds: managerProcedure
    .input(bulkIdsSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).listByIds(await requireOrg(), input.ids),
    ),
  get: managerProcedure
    .input(memberIdSchema)
    .query(async ({ ctx, input }) => makeService(ctx.db).get(await requireOrg(), input.memberId)),
  stats: managerProcedure
    .input(memberIdSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).stats(await requireOrg(), input.memberId, STATS_TZ),
    ),
  activity: managerProcedure
    .input(employeeActivityInputSchema)
    .query(async ({ ctx, input }) => makeService(ctx.db).activity(await requireOrg(), input)),
  leaderboard: managerProcedure
    .input(leaderboardInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).leaderboard(await requireOrg(), input, STATS_TZ),
    ),

  // ── Sessions (owner-only — needs admin-plugin capability) ───────────────────
  listSessions: ownerProcedure
    .input(memberIdSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).listSessions(await requireOrg(), actorOf(ctx), input.memberId),
    ),
  revokeSessions: ownerProcedure
    .input(revokeSessionSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).revokeSessions(
        await requireOrg(),
        actorOf(ctx),
        input.memberId,
        input.sessionToken,
      ),
    ),

  // ── Mutations (owner-only) ──────────────────────────────────────────────────
  invite: ownerProcedure
    .input(inviteEmployeeSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).invite(await requireOrg(), actorOf(ctx), input),
    ),
  update: ownerProcedure
    .input(updateEmployeeSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).update(await requireOrg(), actorOf(ctx), input),
    ),
  setRating: ownerProcedure
    .input(setRatingSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).setRating(await requireOrg(), actorOf(ctx), input.memberId, input.rating),
    ),
  changeEmail: ownerProcedure
    .input(changeEmailSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).changeEmail(await requireOrg(), actorOf(ctx), input.memberId, input.email),
    ),
  disable: ownerProcedure
    .input(disableEmployeeSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).disable(await requireOrg(), actorOf(ctx), input.memberId, input.reason),
    ),
  enable: ownerProcedure
    .input(memberIdSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).enable(await requireOrg(), actorOf(ctx), input.memberId),
    ),
  remove: ownerProcedure
    .input(memberIdSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).remove(await requireOrg(), actorOf(ctx), input.memberId),
    ),
  bulkRemove: ownerProcedure
    .input(bulkIdsSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).bulkRemove(await requireOrg(), actorOf(ctx), input.ids),
    ),
  bulkSetDisabled: ownerProcedure
    .input(bulkSetDisabledSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).bulkSetDisabled(
        await requireOrg(),
        actorOf(ctx),
        input.ids,
        input.disabled,
      ),
    ),

  // ── Impersonation (owner-only; browser mints the session) ───────────────────
  impersonate: ownerProcedure
    .input(impersonateSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).impersonate(await requireOrg(), actorOf(ctx), input.userId),
    ),
  logImpersonationStop: ownerProcedure.mutation(async ({ ctx }) =>
    makeService(ctx.db).logImpersonationStop(await requireOrg(), actorOf(ctx)),
  ),

  // ── Accept invitation (public read + any signed-in user) ────────────────────
  pendingInvitation: publicProcedure
    .input(acceptInviteSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).pendingInvitation(input.invitationId),
    ),
  acceptInvitation: protectedProcedure
    .input(acceptInviteSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).acceptInvitation(actorOf(ctx), input.invitationId),
    ),
});
