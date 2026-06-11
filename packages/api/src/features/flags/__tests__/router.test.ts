import { FlagsManager } from "@loyalty/feature-flags/server";
import { describe, expect, it } from "vitest";

import type { Context } from "../../../trpc";
import { flagsRouter } from "../router";

/** Minimal authed ctx with a faked flags binding pinned to test values. */
function caller(setup: (fake: ReturnType<FlagsManager["fake"]>) => void) {
  const manager = new FlagsManager({ provider: { provider: "null" } });
  setup(manager.fake());
  const ctx = {
    db: {} as never,
    session: { user: { id: "u_1" } },
    headers: new Headers(),
    flags: manager.forRequest({ distinctId: "user:u_1" }),
  } as unknown as Context;
  return flagsRouter.createCaller(ctx);
}

describe("flags.smoke", () => {
  it("returns the server-evaluated boolean + variant from ctx.flags", async () => {
    const result = await caller((fake) => {
      fake.set("flags-smoke", true).set("flags-smoke-ab", "treatment");
    }).smoke();

    expect(result.enabled).toBe(true);
    expect(result.variant).toBe("treatment");
  });

  it("falls back to defaults when the flags are unset", async () => {
    const result = await caller(() => {}).smoke();

    expect(result.enabled).toBe(false);
    expect(result.variant).toBe("control");
  });
});
