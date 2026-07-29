import { type db as Db } from "@loyalty/db";

import { managerProcedure, ownerProcedure, protectedProcedure, publicProcedure, requireOrg, router, staffProcedure } from "../../trpc";
import { cachedListRead } from "../_shared/list-cache";
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
    makeService(ctx.db).myStores(requireOrg(ctx), ctx.session.user.id),
  ),

  // ── Reads (managers + owner) ────────────────────────────────────────────────
  list: managerProcedure
    .input(employeesListInputSchema)
    .query(async ({ ctx, input }) => {
      const org = requireOrg(ctx);
      return cachedListRead(ctx, "employees", org, input, () =>
        makeService(ctx.db).list(org, input),
      );
    }),
  listByIds: managerProcedure
    .input(bulkIdsSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).listByIds(requireOrg(ctx), input.ids),
    ),
  get: managerProcedure
    .input(memberIdSchema)
    .query(async ({ ctx, input }) => makeService(ctx.db).get(requireOrg(ctx), input.memberId)),
  stats: managerProcedure
    .input(memberIdSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).stats(requireOrg(ctx), input.memberId, STATS_TZ),
    ),
  activity: managerProcedure
    .input(employeeActivityInputSchema)
    .query(async ({ ctx, input }) => makeService(ctx.db).activity(requireOrg(ctx), input)),
  leaderboard: managerProcedure
    .input(leaderboardInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).leaderboard(requireOrg(ctx), input, STATS_TZ),
    ),

  // ── Sessions (owner-only — needs admin-plugin capability) ───────────────────
  listSessions: ownerProcedure
    .input(memberIdSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).listSessions(requireOrg(ctx), actorOf(ctx), input.memberId),
    ),
  revokeSessions: ownerProcedure
    .input(revokeSessionSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).revokeSessions(
        requireOrg(ctx),
        actorOf(ctx),
        input.memberId,
        input.sessionToken,
      ),
    ),

  // ── Mutations (owner-only) ──────────────────────────────────────────────────
  invite: ownerProcedure
    .input(inviteEmployeeSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).invite(requireOrg(ctx), actorOf(ctx), input),
    ),
  update: ownerProcedure
    .input(updateEmployeeSchema)
    .mutation(async ({ ctx, input }) => {
      const targetUserId = await makeService(ctx.db).update(requireOrg(ctx), actorOf(ctx), input);
      // Role resolution is cached in `auth.me` (see `../../trpc#cachedRead`) —
      // bust it so a role change is reflected immediately instead of waiting
      // out the TTL.
      if (input.role) await ctx.cache?.delete(`role:${targetUserId}`);
    }),
  setRating: ownerProcedure
    .input(setRatingSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).setRating(requireOrg(ctx), actorOf(ctx), input.memberId, input.rating),
    ),
  changeEmail: ownerProcedure
    .input(changeEmailSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).changeEmail(requireOrg(ctx), actorOf(ctx), input.memberId, input.email),
    ),
  disable: ownerProcedure
    .input(disableEmployeeSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).disable(requireOrg(ctx), actorOf(ctx), input.memberId, input.reason),
    ),
  enable: ownerProcedure
    .input(memberIdSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).enable(requireOrg(ctx), actorOf(ctx), input.memberId),
    ),
  remove: ownerProcedure
    .input(memberIdSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).remove(requireOrg(ctx), actorOf(ctx), input.memberId),
    ),
  bulkRemove: ownerProcedure
    .input(bulkIdsSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).bulkRemove(requireOrg(ctx), actorOf(ctx), input.ids),
    ),
  bulkSetDisabled: ownerProcedure
    .input(bulkSetDisabledSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).bulkSetDisabled(
        requireOrg(ctx),
        actorOf(ctx),
        input.ids,
        input.disabled,
      ),
    ),

  // ── Impersonation (owner-only; browser mints the session) ───────────────────
  impersonate: ownerProcedure
    .input(impersonateSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).impersonate(requireOrg(ctx), actorOf(ctx), input.userId),
    ),
  logImpersonationStop: ownerProcedure.mutation(async ({ ctx }) =>
    makeService(ctx.db).logImpersonationStop(requireOrg(ctx), actorOf(ctx)),
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
