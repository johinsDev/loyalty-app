import { type db as Db } from "@loyalty/db";

import {
  type CacheBinding,
  managerProcedure,
  ownerProcedure,
  protectedProcedure,
  publicProcedure,
  requireOrg,
  roleCacheKey,
  router,
  staffProcedure,
} from "../../trpc";
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
 * Drop cached `member.role` entries for the users a mutation just touched.
 * Both `auth.me` and the `enforceRole` gate read that cache, so skipping this
 * would leave a demoted or removed employee authorized until the TTL expires.
 */
async function bustRoles(ctx: { cache?: CacheBinding }, ...userIds: string[]): Promise<void> {
  await Promise.all(userIds.map((id) => ctx.cache?.delete(roleCacheKey(id))));
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
      // `member.role` is cached (by `auth.me` AND the `enforceRole` gate), so a
      // demotion would otherwise linger for up to the TTL. Bust it here.
      if (input.role) await bustRoles(ctx, targetUserId);
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
    .mutation(async ({ ctx, input }) => {
      const userId = await makeService(ctx.db).disable(
        requireOrg(ctx),
        actorOf(ctx),
        input.memberId,
        input.reason,
      );
      await bustRoles(ctx, userId);
    }),
  enable: ownerProcedure
    .input(memberIdSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = await makeService(ctx.db).enable(
        requireOrg(ctx),
        actorOf(ctx),
        input.memberId,
      );
      await bustRoles(ctx, userId);
    }),
  remove: ownerProcedure
    .input(memberIdSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = await makeService(ctx.db).remove(
        requireOrg(ctx),
        actorOf(ctx),
        input.memberId,
      );
      await bustRoles(ctx, userId);
    }),
  bulkRemove: ownerProcedure
    .input(bulkIdsSchema)
    .mutation(async ({ ctx, input }) => {
      const userIds = await makeService(ctx.db).bulkRemove(
        requireOrg(ctx),
        actorOf(ctx),
        input.ids,
      );
      await bustRoles(ctx, ...userIds);
    }),
  bulkSetDisabled: ownerProcedure
    .input(bulkSetDisabledSchema)
    .mutation(async ({ ctx, input }) => {
      const userIds = await makeService(ctx.db).bulkSetDisabled(
        requireOrg(ctx),
        actorOf(ctx),
        input.ids,
        input.disabled,
      );
      await bustRoles(ctx, ...userIds);
    }),

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
