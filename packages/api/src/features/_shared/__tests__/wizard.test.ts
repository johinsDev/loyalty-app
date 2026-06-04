import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  REVIEW_STEP,
  Wizard,
  WizardStep,
  type WizardContext,
} from "../wizard";

// A tiny two-step draft: step "b" is gated behind "a".
interface Draft {
  a?: string;
  b?: string;
}

class StepA extends WizardStep<Draft, { a: string }> {
  readonly key = "a";
  readonly schema = z.object({ a: z.string().min(1) });
  isComplete(draft: Draft) {
    return draft.a != null;
  }
  async persist(_ctx: WizardContext, draft: Draft, input: { a: string }) {
    return { ...draft, a: input.a };
  }
}

class StepB extends WizardStep<Draft, { b: string }> {
  readonly key = "b";
  readonly schema = z.object({ b: z.string().min(1) });
  override canEnter(draft: Draft) {
    return draft.a != null; // gate: needs step "a" done first
  }
  isComplete(draft: Draft) {
    return draft.b != null;
  }
  async persist(_ctx: WizardContext, draft: Draft, input: { b: string }) {
    return { ...draft, b: input.b };
  }
}

const wizard = new Wizard<Draft>([new StepA(), new StepB()]);
const ctx: WizardContext = {
  db: {} as never,
  organizationId: "org_1",
  userId: "user_1",
  services: undefined,
};

describe("Wizard.state (the iterator)", () => {
  it("points at the first incomplete step", () => {
    expect(wizard.state({})).toEqual({
      order: ["a", "b"],
      completed: [],
      current: "a",
      canPublish: false,
    });
  });

  it("advances current as steps complete, skipping gated ones", () => {
    expect(wizard.state({ a: "x" })).toMatchObject({
      completed: ["a"],
      current: "b",
      canPublish: false,
    });
  });

  it("reports review + canPublish once every step is complete", () => {
    expect(wizard.state({ a: "x", b: "y" })).toMatchObject({
      completed: ["a", "b"],
      current: REVIEW_STEP,
      canPublish: true,
    });
  });
});

describe("Wizard.advance", () => {
  it("validates + persists a step and returns the next state", async () => {
    const { draft, state } = await wizard.advance(ctx, {}, "a", { a: "hello" });
    expect(draft).toEqual({ a: "hello" });
    expect(state.current).toBe("b");
  });

  it("rejects a gated step with PRECONDITION_FAILED", async () => {
    await expect(
      wizard.advance(ctx, {}, "b", { b: "y" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("rejects invalid input with BAD_REQUEST + a ZodError cause", async () => {
    await expect(
      wizard.advance(ctx, {}, "a", { a: "" }),
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof TRPCError &&
        err.code === "BAD_REQUEST" &&
        err.cause instanceof z.ZodError,
    );
  });

  it("rejects an unknown step with NOT_FOUND", async () => {
    await expect(
      wizard.advance(ctx, {}, "nope", {}),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
