import { type db as Db } from "@loyalty/db";

import { orgId, router, staffProcedure } from "../../trpc";
import { AdminNotificationRepository } from "./repository";
import {
  adminAlertsListInputSchema,
  alertIdSchema,
  alertIdsSchema,
  unreadCountInputSchema,
} from "./schemas";
import { AdminNotificationService } from "./service";

function buildService(db: typeof Db): AdminNotificationService {
  return new AdminNotificationService(new AdminNotificationRepository(db));
}

/**
 * The operator's own inbox. Everything is keyed off `ctx.session.user.id`, so
 * there is no "read someone else's alerts" surface at all — fan-out already
 * decided the audience when the alert was emitted.
 */
export const adminNotificationsRouter = router({
  listMine: staffProcedure
    .input(adminAlertsListInputSchema)
    .query(({ ctx, input }) =>
      buildService(ctx.db).list(ctx.session.user.id, orgId(ctx), input),
    ),

  unreadCount: staffProcedure
    .input(unreadCountInputSchema.optional())
    .query(({ ctx, input }) =>
      buildService(ctx.db).unreadCount(
        ctx.session.user.id,
        orgId(ctx),
        input?.storeId,
      ),
    ),

  markRead: staffProcedure
    .input(alertIdSchema)
    .mutation(({ ctx, input }) =>
      buildService(ctx.db).markRead(input.id, ctx.session.user.id, orgId(ctx)),
    ),

  markAllRead: staffProcedure.mutation(({ ctx }) =>
    buildService(ctx.db).markAllRead(ctx.session.user.id, orgId(ctx)),
  ),

  archive: staffProcedure
    .input(alertIdsSchema)
    .mutation(({ ctx, input }) =>
      buildService(ctx.db).archive(input.ids, ctx.session.user.id, orgId(ctx)),
    ),

  archiveAll: staffProcedure.mutation(({ ctx }) =>
    buildService(ctx.db).archiveAll(ctx.session.user.id, orgId(ctx)),
  ),

  unarchive: staffProcedure
    .input(alertIdsSchema)
    .mutation(({ ctx, input }) =>
      buildService(ctx.db).unarchive(
        input.ids,
        ctx.session.user.id,
        orgId(ctx),
      ),
    ),
});
