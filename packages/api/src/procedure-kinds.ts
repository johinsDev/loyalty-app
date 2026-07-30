import type { AnyTRPCRouter } from "@trpc/server";

import type { ProcedureKind } from "./procedure-types";

/** Read the dotted procedure path → kind map straight off a built router.
 *  Used by the generator script and by the drift test; never by the FE (that
 *  one reads the generated literal instead, so it doesn't bundle the router). */
export function procedureKinds(router: AnyTRPCRouter): Record<string, ProcedureKind> {
  const procedures = (
    router as unknown as {
      _def: { procedures: Record<string, { _def: { type: ProcedureKind } }> };
    }
  )._def.procedures;
  return Object.fromEntries(
    Object.entries(procedures).map(([path, proc]) => [path, proc._def.type]),
  );
}
