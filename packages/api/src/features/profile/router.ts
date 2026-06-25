import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";

import { buildPointsService } from "../points";
import {
  protectedProcedure,
  type RealtimeBinding,
  rateLimit,
  router,
} from "../../trpc";
import { ProfileRepository } from "./repository";
import {
  checkNicknameInputSchema,
  confirmPhoneChangeInputSchema,
  updateAvatarInputSchema,
  updateNameInputSchema,
  updateNicknameInputSchema,
} from "./schemas";
import { ProfileService } from "./service";

const orgId = async (): Promise<string> =>
  (await getPrimaryOrganizationId()) ?? "";

function buildProfileService(ctx: {
  db: typeof Db;
  realtime?: RealtimeBinding;
}): ProfileService {
  const points = buildPointsService(ctx);
  return new ProfileService(new ProfileRepository(ctx.db), {
    pointsSummary: async (org, customerId) => {
      const summary = await points.mySummary(org, customerId);
      return { balance: summary.balance, tierName: summary.current.name };
    },
  });
}

export const profileRouter = router({
  me: protectedProcedure.query(async ({ ctx }) =>
    buildProfileService(ctx).me(await orgId(), ctx.session.user.id),
  ),

  checkNickname: protectedProcedure
    .input(checkNicknameInputSchema)
    .query(async ({ ctx, input }) =>
      buildProfileService(ctx).checkNickname(
        await orgId(),
        ctx.session.user.id,
        input.nickname,
      ),
    ),

  updateName: protectedProcedure
    .input(updateNameInputSchema)
    .mutation(async ({ ctx, input }) =>
      buildProfileService(ctx).updateName(
        await orgId(),
        ctx.session.user.id,
        input.name,
      ),
    ),

  updateNickname: protectedProcedure
    .use(rateLimit({ name: "profile.nickname", limit: 20, window: "1m", by: "user" }))
    .input(updateNicknameInputSchema)
    .mutation(async ({ ctx, input }) =>
      buildProfileService(ctx).updateNickname(
        await orgId(),
        ctx.session.user.id,
        input.nickname,
      ),
    ),

  updateAvatar: protectedProcedure
    .input(updateAvatarInputSchema)
    .mutation(async ({ ctx, input }) =>
      buildProfileService(ctx).updateAvatar(
        await orgId(),
        ctx.session.user.id,
        input,
      ),
    ),

  confirmPhoneChange: protectedProcedure
    .use(rateLimit({ name: "profile.phone", limit: 10, window: "1m", by: "user" }))
    .input(confirmPhoneChangeInputSchema)
    .mutation(async ({ ctx, input }) =>
      buildProfileService(ctx).confirmPhoneChange(
        await orgId(),
        ctx.session.user.id,
        input.newPhone,
      ),
    ),

  syncEmail: protectedProcedure.mutation(async ({ ctx }) =>
    buildProfileService(ctx).syncEmail(
      await orgId(),
      ctx.session.user.id,
      ctx.session.user.email,
    ),
  ),
});
