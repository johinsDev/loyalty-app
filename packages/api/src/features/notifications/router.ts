import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";

import {
  managerProcedure,
  protectedProcedure,
  rateLimit,
  router,
  staffProcedure,
} from "../../trpc";
import { DrizzleNotificationPreferences } from "./preferences-repository";
import { NotificationRepository } from "./repository";
import {
  deleteInputSchema,
  listCustomersInputSchema,
  listMineInputSchema,
  markReadInputSchema,
  sendInputSchema,
  setPreferenceInputSchema,
} from "./schemas";
import { NotificationService } from "./service";

function buildService(db: typeof Db): NotificationService {
  return new NotificationService(
    new NotificationRepository(db),
    new DrizzleNotificationPreferences(db),
  );
}

/** The single principal org (single-tenant pilot). No env var needed. */
const orgId = async (): Promise<string> =>
  (await getPrimaryOrganizationId()) ?? "";

export const notificationsRouter = router({
  // ---- Customer-facing feed -------------------------------------------
  listMine: protectedProcedure
    .input(listMineInputSchema)
    .query(async ({ ctx, input }) =>
      buildService(ctx.db).listMine(ctx.session.user.id, await orgId(), input),
    ),

  unreadCount: protectedProcedure.query(async ({ ctx }) =>
    buildService(ctx.db).unreadCount(ctx.session.user.id, await orgId()),
  ),

  markRead: protectedProcedure
    .input(markReadInputSchema)
    .mutation(({ ctx, input }) =>
      buildService(ctx.db).markRead(input.id, ctx.session.user.id),
    ),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) =>
    buildService(ctx.db).markAllRead(ctx.session.user.id, await orgId()),
  ),

  delete: protectedProcedure
    .input(deleteInputSchema)
    .mutation(({ ctx, input }) =>
      buildService(ctx.db).remove(input.id, ctx.session.user.id),
    ),

  deleteAll: protectedProcedure.mutation(async ({ ctx }) =>
    buildService(ctx.db).removeAll(ctx.session.user.id, await orgId()),
  ),

  // ---- Customer-facing preferences ------------------------------------
  getMyPreferences: protectedProcedure.query(async ({ ctx }) =>
    buildService(ctx.db).getMyPreferences(ctx.session.user.id, await orgId()),
  ),

  setPreference: protectedProcedure
    .input(setPreferenceInputSchema)
    .mutation(async ({ ctx, input }) =>
      buildService(ctx.db).setPreference(
        ctx.session.user.id,
        await orgId(),
        input.channel,
        input.marketingEnabled,
      ),
    ),

  // ---- Admin ----------------------------------------------------------
  listCustomers: staffProcedure
    .input(listCustomersInputSchema)
    .query(async ({ ctx, input }) =>
      buildService(ctx.db).listCustomers(await orgId(), input),
    ),

  send: managerProcedure
    .use(
      rateLimit({ name: "notifications.send", limit: 30, window: "1m", by: "user" }),
    )
    .input(sendInputSchema)
    .mutation(async ({ ctx, input }) =>
      buildService(ctx.db).send(await orgId(), input),
    ),
});
