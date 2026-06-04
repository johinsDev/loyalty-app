import type { db as Db } from "@loyalty/db";
import { TRPCError } from "@trpc/server";
import type { ZodType } from "zod";

/**
 * Server-driven multi-step "wizard" engine, the iterator sibling of
 * `./filters.ts`. Where `Filters` walks `allowedFilters()` and dispatches to a
 * method per key, a `Wizard` walks an ordered list of `WizardStep`s and derives
 * "which step are you on" from the draft's own completeness — the backend owns
 * the sequence, gating and validation, and the frontend just renders whatever
 * step `state()` reports.
 *
 * The draft is the real entity in `draft` status (entity-as-draft): each step's
 * `persist` fills real columns; nothing here knows about a separate draft table.
 *
 * See `.claude/skills/wizard/SKILL.md` for the full pattern + the Promociones
 * reference built on top of it.
 */

/** Per-request bag handed to every step. `services` is the feature's own
 *  service/repo bundle so a step can validate against sibling services
 *  ("each step connects to its service"). */
export interface WizardContext<TServices = unknown> {
  db: typeof Db;
  organizationId: string;
  userId: string;
  services: TServices;
}

/**
 * One step of a wizard. Owns: its key, its Zod schema (what it validates), an
 * optional gate (`canEnter`), a completeness check derived from the draft, and
 * how to persist its slice. Subclasses narrow `TInput`; the engine stores them
 * type-erased and relies on the step instance to validate + persist its own shape.
 */
export abstract class WizardStep<TDraft, TInput, TServices = unknown> {
  /** Stable key, e.g. `"segment"`. Matches the FE step component + the URL. */
  abstract readonly key: string;
  /** Validates this step's input slice. Reused verbatim by the FE form. */
  abstract readonly schema: ZodType<TInput>;

  /** Precondition gate. Default: always enterable. Override to require an
   *  earlier step (e.g. products needs a segment first). */
  canEnter(_draft: TDraft): boolean {
    return true;
  }

  /** Whether the draft already satisfies this step — derived from its columns,
   *  never stored. Drives `state().current` + `canPublish`. */
  abstract isComplete(draft: TDraft): boolean;

  /** Write this step's validated input into the draft entity (via
   *  `ctx.services`), returning the updated draft. */
  abstract persist(
    ctx: WizardContext<TServices>,
    draft: TDraft,
    input: TInput,
  ): Promise<TDraft>;
}

/** Sentinel `current` value once every step is complete. */
export const REVIEW_STEP = "review" as const;

export interface WizardState {
  /** Ordered step keys (the FE renders the stepper from this). */
  order: string[];
  /** Keys whose `isComplete` is true. */
  completed: string[];
  /** First enterable, not-yet-complete step — or `"review"` when all done. */
  current: string;
  /** True once every step is complete (publish is allowed). */
  canPublish: boolean;
}

export class Wizard<TDraft, TServices = unknown> {
  private readonly steps: ReadonlyArray<WizardStep<TDraft, unknown, TServices>>;

  constructor(steps: ReadonlyArray<WizardStep<TDraft, unknown, TServices>>) {
    if (steps.length === 0) {
      throw new Error("A Wizard needs at least one step");
    }
    this.steps = steps;
  }

  order(): string[] {
    return this.steps.map((s) => s.key);
  }

  /** The iterator: compute the draft's position purely from completeness. */
  state(draft: TDraft): WizardState {
    const completed = this.steps
      .filter((s) => s.isComplete(draft))
      .map((s) => s.key);
    const done = new Set(completed);
    const next = this.steps.find((s) => s.canEnter(draft) && !done.has(s.key));
    return {
      order: this.order(),
      completed,
      current: next ? next.key : REVIEW_STEP,
      canPublish: this.steps.every((s) => s.isComplete(draft)),
    };
  }

  step(key: string): WizardStep<TDraft, unknown, TServices> {
    const step = this.steps.find((s) => s.key === key);
    if (!step) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Unknown wizard step "${key}"`,
      });
    }
    return step;
  }

  /**
   * Validate + persist one step. Gate first (`PRECONDITION_FAILED`), then Zod
   * (`BAD_REQUEST` with the ZodError as `cause`, so the existing tRPC
   * errorFormatter surfaces `zodError`), then persist. Returns the updated
   * draft + recomputed state so the caller can hand the FE its next step.
   */
  async advance(
    ctx: WizardContext<TServices>,
    draft: TDraft,
    key: string,
    rawInput: unknown,
  ): Promise<{ draft: TDraft; state: WizardState }> {
    const step = this.step(key);
    if (!step.canEnter(draft)) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Step "${key}" can't be entered yet`,
      });
    }
    const parsed = step.schema.safeParse(rawInput);
    if (!parsed.success) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Invalid input for step "${key}"`,
        cause: parsed.error,
      });
    }
    const updated = await step.persist(ctx, draft, parsed.data);
    return { draft: updated, state: this.state(updated) };
  }
}
