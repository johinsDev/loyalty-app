import { publicProcedure, router } from "../../trpc";
import { PushOutboxRepository } from "./repository";
import {
  getInputSchema,
  latestForRecipientInputSchema,
  listInputSchema,
} from "./schemas";
import { PushOutboxService } from "./service";

/**
 * `publicProcedure` on purpose: the dev view on apps/web is gated by
 * env (`apps/web/src/lib/dev-only.ts`), not by auth. Production
 * deploys serve 404 at the page + endpoint layer, so this router
 * stays safely empty in prod.
 */
export const pushOutboxRouter = router({
  list: publicProcedure
    .input(listInputSchema)
    .query(({ ctx, input }) => {
      const service = new PushOutboxService(new PushOutboxRepository(ctx.db));
      return service.list(input);
    }),

  get: publicProcedure.input(getInputSchema).query(({ ctx, input }) => {
    const service = new PushOutboxService(new PushOutboxRepository(ctx.db));
    return service.get(input.id);
  }),

  latestForRecipient: publicProcedure
    .input(latestForRecipientInputSchema)
    .query(({ ctx, input }) => {
      const service = new PushOutboxService(new PushOutboxRepository(ctx.db));
      return service.latestForRecipient(input);
    }),
});
