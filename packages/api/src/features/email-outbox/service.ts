import type { EmailOutboxRow } from "@loyalty/db/schema";
import { TRPCError } from "@trpc/server";

import type { EmailOutboxRepository, ListResult } from "./repository";
import type { LatestForRecipientInput, ListInput } from "./schemas";

/**
 * Thin pass-through today. Lives here so future business rules
 * (mask body for non-admins, enforce compliance redaction, hide
 * failed sends from non-staff) have a single home above the
 * repository.
 */
export class EmailOutboxService {
  constructor(private readonly repo: EmailOutboxRepository) {}

  list(input: ListInput): Promise<ListResult> {
    return this.repo.list(input);
  }

  async get(id: string): Promise<EmailOutboxRow> {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `email_outbox row "${id}" not found`,
      });
    }
    return row;
  }

  latestForRecipient(
    input: LatestForRecipientInput,
  ): Promise<EmailOutboxRow[]> {
    return this.repo.latestForRecipient(input);
  }
}
