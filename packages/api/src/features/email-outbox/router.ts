import { tasks } from "@trigger.dev/sdk/v3";

import { ownerProcedure, publicProcedure, router } from "../../trpc";
import { EmailOutboxRepository } from "./repository";
import {
  getInputSchema,
  latestForRecipientInputSchema,
  listInputSchema,
  sendTestInputSchema,
} from "./schemas";
import { EmailOutboxService } from "./service";

// Untyped trigger by ID — typing the payload would couple @loyalty/api
// to @loyalty/jobs, but jobs already depends on api (cycle). The shape
// stays in sync with packages/jobs/trigger/send-test-email.ts.
type SendTestEmailPayload =
  | {
      mode: "template";
      to: string;
      templateId: "welcome" | "magic-link";
      mailer?: "log" | "outbox" | "resend";
    }
  | {
      mode: "custom";
      to: string;
      subject: string;
      html: string;
      mailer?: "log" | "outbox" | "resend";
    };

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

  /**
   * Owner-only smoke helper behind the admin /email-outbox dev tool.
   * Queues the `send-test-email` Trigger.dev task (template or custom
   * body, optional mailer override) and returns immediately. Unlike the
   * read procedures this is `ownerProcedure`: sending is a real side
   * effect, so it's gated server-side, not just at the page layer.
   */
  sendTest: ownerProcedure
    .input(sendTestInputSchema)
    .mutation(async ({ input }) => {
      await tasks.trigger("send-test-email", input as SendTestEmailPayload);
      return { ok: true as const };
    }),
});
