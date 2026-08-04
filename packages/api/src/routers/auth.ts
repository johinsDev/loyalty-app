import { getUserRole } from "@loyalty/auth/server";
import { customerExistsForUser, phoneNumberInUse } from "@loyalty/db";
import { z } from "zod";

import { cachedRead, protectedProcedure, ROLE_TTL_SECONDS, roleCacheKey, router } from "../trpc";

/**
 * Auth/session helpers for the front-ends. `me` resolves the current user, their
 * `member.role`, and whether they have a loyalty `customer` row in one
 * round-trip, so each app's server-side auth-guard runs through the Worker
 * (post-cutover) instead of reading the DB directly. It's a `protectedProcedure`
 * → an anonymous caller gets UNAUTHORIZED, which the guard turns into a sign-in
 * redirect. `isCustomer` drives the web app's `requireCustomer` phone-capture
 * gate — it's the authoritative signal (set when a phone is verified), unlike
 * the session user's `phoneNumber` field which isn't reliably surfaced here.
 */
export const authRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const [role, isCustomer] = await Promise.all([
      cachedRead(ctx, roleCacheKey(userId), ROLE_TTL_SECONDS, () => getUserRole(userId)),
      customerExistsForUser(userId),
    ]);
    // `organizationId` rides along because it's already resolved (and cached)
    // on the context: the admin needs it client-side to join its `org:` room.
    return {
      user: ctx.session.user,
      role,
      isCustomer,
      organizationId: ctx.organizationId ?? null,
    };
  }),

  /**
   * Whether a phone can be linked to the current account — false when it's
   * already registered to another user. Lets /complete-phone warn upfront
   * instead of sending an OTP the user could never verify (the phone is taken).
   */
  phoneAvailable: protectedProcedure
    .input(z.object({ phone: z.string() }))
    .query(async ({ ctx, input }) => {
      const taken = await phoneNumberInUse(input.phone, ctx.session.user.id);
      return { available: !taken };
    }),
});
