import type { db as Db } from "@loyalty/db";

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

const org = (): string => process.env.LOYALTY_ORG_ID ?? "";

export const notificationsRouter = router({
  // ---- Customer-facing feed -------------------------------------------
  listMine: protectedProcedure
    .input(listMineInputSchema)
    .query(({ ctx, input }) =>
      buildService(ctx.db).listMine(ctx.session.user.id, org(), input),
    ),

  unreadCount: protectedProcedure.query(({ ctx }) =>
    buildService(ctx.db).unreadCount(ctx.session.user.id, org()),
  ),

  markRead: protectedProcedure
    .input(markReadInputSchema)
    .mutation(({ ctx, input }) =>
      buildService(ctx.db).markRead(input.id, ctx.session.user.id),
    ),

  markAllRead: protectedProcedure.mutation(({ ctx }) =>
    buildService(ctx.db).markAllRead(ctx.session.user.id, org()),
  ),

  // ---- Customer-facing preferences ------------------------------------
  getMyPreferences: protectedProcedure.query(({ ctx }) =>
    buildService(ctx.db).getMyPreferences(ctx.session.user.id, org()),
  ),

  setPreference: protectedProcedure
    .input(setPreferenceInputSchema)
    .mutation(({ ctx, input }) =>
      buildService(ctx.db).setPreference(
        ctx.session.user.id,
        org(),
        input.channel,
        input.marketingEnabled,
      ),
    ),

  // ---- Admin ----------------------------------------------------------
  listCustomers: staffProcedure
    .input(listCustomersInputSchema)
    .query(({ ctx, input }) => buildService(ctx.db).listCustomers(org(), input)),

  send: managerProcedure
    .use(
      rateLimit({ name: "notifications.send", limit: 30, window: "1m", by: "user" }),
    )
    .input(sendInputSchema)
    .mutation(({ ctx, input }) => buildService(ctx.db).send(org(), input)),
});
