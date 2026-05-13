import { publicProcedure, router } from "../../trpc";
import { EmailOutboxRepository } from "./repository";
import {
  getInputSchema,
  latestForRecipientInputSchema,
  listInputSchema,
} from "./schemas";
import { EmailOutboxService } from "./service";

/**
 * `publicProcedure` on purpose: the dev view on apps/web is gated by
 * env (`apps/web/src/lib/dev-only.ts`), not by auth. Production
 * deploys serve 404 at the page + endpoint layer, so this router
 * stays safely empty in prod.
 */
export const emailOutboxRouter = router({
  list: publicProcedure
    .input(listInputSchema)
    .query(({ ctx, input }) => {
      const service = new EmailOutboxService(
        new EmailOutboxRepository(ctx.db),
      );
      return service.list(input);
    }),

  get: publicProcedure
    .input(getInputSchema)
    .query(({ ctx, input }) => {
      const service = new EmailOutboxService(
        new EmailOutboxRepository(ctx.db),
      );
      return service.get(input.id);
    }),

  latestForRecipient: publicProcedure
    .input(latestForRecipientInputSchema)
    .query(({ ctx, input }) => {
      const service = new EmailOutboxService(
        new EmailOutboxRepository(ctx.db),
      );
      return service.latestForRecipient(input);
    }),
});
