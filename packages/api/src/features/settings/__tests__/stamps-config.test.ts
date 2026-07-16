import { describe, expect, it } from "vitest";

import { shouldReevaluateStampGoal, validateStampCopy } from "../service";

describe("validateStampCopy", () => {
  it("accepts empty overrides", () => {
    expect(() => validateStampCopy({})).not.toThrow();
    expect(() => validateStampCopy({ es: {} })).not.toThrow();
  });

  it("accepts plain text on free-form keys", () => {
    expect(() =>
      validateStampCopy({ es: { title: "Tu tarjeta T4", paused: "En pausa" } }),
    ).not.toThrow();
  });

  it("accepts {count} where allowed", () => {
    expect(() =>
      validateStampCopy({
        es: { subtitle: "¡Solo {count} más!", emptyBody: "Te faltan {count}" },
      }),
    ).not.toThrow();
  });

  it("subtitle may drop {count} (allowed, not required)", () => {
    expect(() =>
      validateStampCopy({ es: { subtitle: "¡Completa tu tarjeta!" } }),
    ).not.toThrow();
  });

  it("rejects emptyBody without its required {count}", () => {
    expect(() =>
      validateStampCopy({ es: { emptyBody: "Ya casi lo logras" } }),
    ).toThrowError(/STAMPS_COPY_PLACEHOLDER:es\.emptyBody/);
  });

  it("rejects unknown placeholders (they'd render literally)", () => {
    expect(() =>
      validateStampCopy({ en: { title: "Hi {name}" } }),
    ).toThrowError(/STAMPS_COPY_PLACEHOLDER:en\.title/);
    expect(() =>
      validateStampCopy({ es: { emptyBody: "Faltan {count} de {total}" } }),
    ).toThrowError(/STAMPS_COPY_PLACEHOLDER:es\.emptyBody/);
  });
});

describe("shouldReevaluateStampGoal", () => {
  const linked9 = { goal: 9, cardRewardId: "rw_a" };

  it("triggers when the goal is lowered on the same reward", () => {
    expect(
      shouldReevaluateStampGoal(linked9, { goal: 5, cardRewardId: "rw_a" }),
    ).toBe(true);
  });

  it("does not trigger when the goal is raised", () => {
    expect(
      shouldReevaluateStampGoal(linked9, { goal: 12, cardRewardId: "rw_a" }),
    ).toBe(false);
  });

  it("does not trigger on an unchanged save", () => {
    expect(
      shouldReevaluateStampGoal(linked9, { goal: 9, cardRewardId: "rw_a" }),
    ).toBe(false);
  });

  it("triggers on a relink even at the same goal", () => {
    expect(
      shouldReevaluateStampGoal(linked9, { goal: 9, cardRewardId: "rw_b" }),
    ).toBe(true);
  });

  it("triggers when linking for the first time (fallback 9 → linked lower)", () => {
    expect(
      shouldReevaluateStampGoal(
        { goal: 9, cardRewardId: null },
        { goal: 5, cardRewardId: "rw_a" },
      ),
    ).toBe(true);
  });

  it("never triggers on unlink (goal falls back, nothing to arm)", () => {
    expect(
      shouldReevaluateStampGoal(linked9, { goal: 5, cardRewardId: null }),
    ).toBe(false);
  });
});
