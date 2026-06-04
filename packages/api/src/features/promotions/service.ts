import type { db as Db } from "@loyalty/db";
import type { PromoRow } from "@loyalty/db/schema";
import { TRPCError } from "@trpc/server";

import type { WizardState } from "../_shared/wizard";
import type { ListResult, PromoRepository } from "./repository";
import type { ListInput, PromoStepKey } from "./schemas";
import { promoWizard } from "./wizard";

export interface PromoStateResult {
  promo: PromoRow;
  state: WizardState;
}

/**
 * Orchestrates the promo wizard: owns the draft lifecycle (create → advance →
 * publish) and delegates the step sequence/validation to `promoWizard`. The
 * frontend never decides the order — it reads `state` and renders `state.current`.
 */
export class PromoService {
  constructor(
    private readonly db: typeof Db,
    private readonly repo: PromoRepository,
  ) {}

  /** Create the draft from "step 0": a `draft` row exists immediately. */
  async create(
    organizationId: string,
    userId: string,
  ): Promise<PromoStateResult> {
    const row = await this.repo.createDraft(organizationId, userId);
    return { promo: row, state: promoWizard.state(row) };
  }

  async getState(
    organizationId: string,
    id: string,
  ): Promise<PromoStateResult> {
    const row = await this.loadDraft(organizationId, id);
    return { promo: row, state: promoWizard.state(row) };
  }

  /** Validate + persist one step, then report the recomputed state. */
  async advance(
    organizationId: string,
    userId: string,
    id: string,
    step: PromoStepKey,
    input: unknown,
  ): Promise<PromoStateResult> {
    const current = await this.loadDraft(organizationId, id);
    if (current.status !== "draft") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "This promo is already published and can't be edited",
      });
    }
    const { draft, state } = await promoWizard.advance(
      { db: this.db, organizationId, userId, services: { repo: this.repo } },
      current,
      step,
      input,
    );
    return { promo: draft, state };
  }

  /** Flip to `published` once every step is complete (idempotent). */
  async publish(
    organizationId: string,
    id: string,
  ): Promise<PromoStateResult> {
    const current = await this.loadDraft(organizationId, id);
    if (current.status === "published") {
      return { promo: current, state: promoWizard.state(current) };
    }
    const state = promoWizard.state(current);
    if (!state.canPublish) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Complete every step before publishing",
      });
    }
    const published = await this.repo.markPublished(organizationId, id);
    return { promo: published, state: promoWizard.state(published) };
  }

  list(organizationId: string, input: ListInput): Promise<ListResult> {
    return this.repo.list(organizationId, input);
  }

  private async loadDraft(
    organizationId: string,
    id: string,
  ): Promise<PromoRow> {
    const row = await this.repo.findById(organizationId, id);
    if (!row) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `promo "${id}" not found`,
      });
    }
    return row;
  }
}
