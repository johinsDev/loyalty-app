import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { procedureKinds } from "../procedure-kinds";
import { PROCEDURE_TYPES } from "../procedure-types";
import { appRouter } from "../routers/_app";

/**
 * The FE's RSC tRPC caller dispatches `.query`/`.mutation` off the generated
 * `PROCEDURE_TYPES` literal instead of importing `appRouter` (which would pull
 * the whole backend into the Next serverless function). A procedure missing
 * from the literal silently resolves to `undefined` at runtime — so guard it
 * here: add a procedure, run `bun run --cwd packages/api gen:procedure-types`.
 */
describe("PROCEDURE_TYPES", () => {
  it("matches the live router", () => {
    expect(PROCEDURE_TYPES).toEqual(procedureKinds(appRouter));
  });

  it("has no runtime imports (so the FE doesn't bundle the backend)", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../procedure-types.ts", import.meta.url)),
      "utf8",
    );
    expect(source).not.toMatch(/^\s*import\s/m);
  });
});
