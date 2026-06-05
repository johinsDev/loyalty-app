import { getUserRole } from "@loyalty/auth/server";

import { protectedProcedure, router } from "../trpc";

/**
 * Auth/session helpers for the front-ends. `me` resolves the current user + their
 * `member.role` in one round-trip, so each app's server-side auth-guard can run
 * through the Worker (post-cutover) instead of reading the DB directly. It's a
 * `protectedProcedure` → an anonymous caller gets UNAUTHORIZED, which the guard
 * turns into a sign-in redirect.
 */
export const authRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const role = await getUserRole(ctx.session.user.id);
    return { user: ctx.session.user, role };
  }),
});
